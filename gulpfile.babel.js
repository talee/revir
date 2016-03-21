import babelify from 'babelify'
import browserSync from 'browser-sync'
import browserify from 'browserify'
import del from 'del'
import gulp from 'gulp'
import gutil from 'gulp-util'
import jscs from 'gulp-jscs'
import jshint from 'gulp-jshint'
import map from 'map-stream'
import source from 'vinyl-source-stream'
import watchify from 'watchify'

const c = gutil.colors

// ----------------------------------------
// TASKS
// ----------------------------------------
const tasks = {
  bundle(fileIds) {
    // Only compile bundle if file passes lint
    if (fileIds && fileIds.length) {
      gutil.log('Files changed:', fileIds)
      return tasks.lintGiven(fileIds)
        .pipe(map((file, done) => {
          if (file.jshint.success) {
            tasks.browserify().on('end', done)
          } else {
            // watchify requires bundle to be called before another update event
            // can be emitted. The stream from bundle must also be consumed.
            gutil.log('Noop bundling.')
            bundler.bundle().pipe(gutil.noop())
            done()
          }
        }))
    } else {
      return tasks.browserify()
    }
  },

  browserify() {
    gutil.log('Browserify bundle running...')
    return bundler
      .bundle()
      .on('error', function(err) {
        gutil.log(c.red('Error: ') + c.yellow(err.message))
        browserSync.notify('Browserify Error!')
        this.emit('end')
      })
      .on('file', function() {gutil.log('bdg:', arguments)})
      .on('end', () => gutil.log('Browserify bundle complete.'))
      .pipe(source('bundle.js'))
      .pipe(gulp.dest('dist/'))
      .pipe(browserSync.stream({once: true}))
  },

  browserSync() {
    browserSync.init({
      open: false,
      server: 'dist/'
    })
  },

  copy() {
    // Copy test page to dist
    return gulp.src('test/index.html')
    .pipe(gulp.dest('dist/'))
  },

  clean() {
    return del('dist/')
  },

  lintGiven(fileIds) {
    fileIds = fileIds.filter(file => file.endsWith('.js'))
    return gulp.src(fileIds)
      .pipe(jshint())
      .pipe(jshint.reporter('jshint-stylish'))
      .pipe(jscs())
      .pipe(jscs.reporter())
  },

  lintjs() {
    return gulp.src([
        'gulpfile.babel.js',
        'src/**/*.js'
      ])
      .pipe(jshint())
      .pipe(jshint.reporter('jshint-stylish'))
      .pipe(jshint.reporter('fail'))
      .pipe(jscs())
      .pipe(jscs.reporter())
      .pipe(jscs.reporter('fail'))
  }
}

// ----------------------------------------
// GULP TASKS
// ----------------------------------------
gulp.task('default', () => {
  tasks.clean().then(() => {
    tasks.copy()
    tasks.bundle()
    tasks.browserSync()
  })
  gutil.log('Watching for changes...')
})
gulp.task('bundle', () => tasks.bundle())
gulp.task('clean', () => tasks.clean())
gulp.task('copy', () => tasks.copy())
gulp.task('lintjs', () => tasks.lintjs())
gulp.task('browserSync', () => tasks.browserSync())

// ----------------------------------------
// BROWSERIFY CONFIG
// ----------------------------------------
var bundler = browserify({
  cache: {},
  debug: true,
  entries: ['src/main.js'],
  packageCache: {},
  // Browserify has issues with relative paths in ES6 modules. To allow import
  // 'a' instead of import './a', we need to declare all paths where code may
  // live.
  paths: ['src/'],
  plugin: [watchify],
  transform: [babelify]
})
// Update triggered from watchify
.on('update', tasks.bundle)
.on('log', msg => gutil.log(msg))
.on('error', function(err) {
  gutil.log('Error: ' + err.message)
  browserSync.notify('Browserify Error!')
  this.emit('end')
})
