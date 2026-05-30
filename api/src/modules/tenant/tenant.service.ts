import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { Tenant } from '@prisma/client';
import { SignupDto } from './dto/signup.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private readonly CACHE_KEY_PREFIX = 'tenant:';
  private readonly CACHE_TTL = 300; // 5 minutes in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async findByApiKey(apiKey: string): Promise<Tenant | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${apiKey}`;
    
    // Attempt to read from cache first
    const cachedTenant = this.cache.get<Tenant>(cacheKey);
    if (cachedTenant) {
      return cachedTenant;
    }

    // Cache miss - query the database
    const tenant = await this.prisma.tenant.findUnique({
      where: { apiKey },
    });

    if (tenant) {
      // Cache the resolved tenant
      this.cache.set(cacheKey, tenant, this.CACHE_TTL);
    }

    return tenant;
  }

  async createTenant(signupDto: SignupDto): Promise<Tenant> {
    const { name, email, siteUrl, shopDomain } = signupDto;

    // Check if shopDomain already registered
    if (shopDomain) {
      const existing = await this.prisma.tenant.findUnique({
        where: { shopDomain },
      });
      if (existing) {
        throw new ConflictException('A merchant with this shop domain is already registered');
      }
    }

    const apiKey = 'tk_live_' + crypto.randomBytes(12).toString('hex');

    // Create the tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        email,
        siteUrl,
        shopDomain: shopDomain || null,
        apiKey,
        allowedOrigins: [siteUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
        etaMode: 'STATIC_RULES',
        codEnabled: false,
      },
    });

    // Create default delivery rules for the new tenant
    const regions = ['south', 'west', 'central', 'north', 'east', 'northeast'];
    const defaultRules = regions.map((region) => {
      let minDays = 3;
      let maxDays = 5;
      if (region === 'south') {
        minDays = 2;
        maxDays = 3;
      }
      return {
        tenantId: tenant.id,
        region,
        minDays,
        maxDays,
        codBlockedPincodes: [],
        isActive: true,
      };
    });

    await this.prisma.deliveryRule.createMany({
      data: defaultRules,
    });

    // Send welcome email asynchronously
    this.sendWelcomeEmail(email, name, apiKey).catch((err) => {
      this.logger.error(`Failed to send welcome email to ${email}: ${err.message}`);
    });

    return tenant;
  }

  async regenerateApiKey(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const newApiKey = 'tk_live_' + crypto.randomBytes(12).toString('hex');

    // Remove cache of old apiKey
    this.cache.del(`${this.CACHE_KEY_PREFIX}${tenant.apiKey}`);

    // Update DB
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { apiKey: newApiKey },
    });

    return newApiKey;
  }

  async updateAllowedOrigins(tenantId: string, allowedOrigins: string[]): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Clean cache entries
    this.cache.del(`${this.CACHE_KEY_PREFIX}${tenant.apiKey}`);
    this.cache.del(`eta-rules:${tenantId}`);
    this.cache.delPrefix(`eta:${tenantId}:`);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { allowedOrigins },
    });

    return updated;
  }

  async updateCodEnabled(tenantId: string, codEnabled: boolean): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Clean cache entries
    this.cache.del(`${this.CACHE_KEY_PREFIX}${tenant.apiKey}`);
    this.cache.delPrefix(`eta:${tenantId}:`);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { codEnabled },
    });

    return updated;
  }

  private async sendWelcomeEmail(email: string, name: string, apiKey: string) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL', 'onboarding@resend.dev');

    const subject = 'Your Delivery ETA Widget API Key';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #333;">Welcome to Delivery ETA SaaS, ${name}!</h2>
        <p>Your account has been successfully configured and activated.</p>
        <p>Use the following API Key to authenticate your widget and dashboard requests:</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 16px; margin: 20px 0; border-left: 4px solid #0066cc;">
          <strong>${apiKey}</strong>
        </div>
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Open the merchant dashboard in your browser.</li>
          <li>Login using your API key.</li>
          <li>Embed the delivery estimate widget on your product pages.</li>
        </ol>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">If you did not sign up for this service, you can ignore this email.</p>
      </div>
    `;

    if (!resendKey || resendKey === 'mock_key' || resendKey.trim() === '') {
      this.logger.log(`[MOCK EMAIL] To: ${email} | Subject: ${subject}`);
      this.logger.log(`[MOCK EMAIL] Content:\n${htmlContent}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        this.logger.error(`Resend API failed: ${response.status} - ${errBody}`);
      } else {
        this.logger.log(`Onboarding email sent successfully to ${email} via Resend.`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error sending email to ${email}: ${error.message}`);
    }
  }
}
