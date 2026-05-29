const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: !isWatch,
  sourcemap: true,
  target: ['es2017'],
  outfile: 'dist/eta-widget.js',
  logLevel: 'info',
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('👀 Watching for file changes...');
  } else {
    await esbuild.build(config);
    console.log('⚡ esbuild build completed successfully.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
