import babelify from 'babelify'
import browserSync from 'browser-sync'
import browserify from 'browserify'
import eslint from 'gulp-eslint'
import del from 'del'
import gulp from 'gulp'
import gutil from 'gulp-util'
import log from 'loglevel'
import map from 'map-stream'
import mocha from 'gulp-mocha'
import source from 'vinyl-source-stream'
import watchify from 'watchify'

const c = gutil.colors
if (!gutil.env.production) {
  log.setLevel('debug')
}

// ----------------------------------------
// TASKS
// ----------------------------------------
const tasks = {
  bundle(fileIds) {
    // Only compile bundle if file passes lint
    if (fileIds && fileIds.length) {
      gutil.log('Files changed:', fileIds)
      return tasks._lintGiven(fileIds)
        .pipe(map((file, done) => {
          // TODO: Continue only if lint has no errors
          tasks.test()
          tasks.browserify().on('end', done)
          //} else {
          //  // watchify requires bundle to be called before another update event
          //  // can be emitted. The stream from bundle must also be consumed.
          //  gutil.log('Noop bundling.')
          //  bundler.bundle().pipe(gutil.noop())
          //  done()
          //}
        }))
    } else {
      tasks.test()
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
    return gulp.src('tests/index.html')
    .pipe(gulp.dest('dist/'))
  },

  clean() {
    return del('dist/')
  },

  die(errcode) {
    errcode = typeof errcode !== 'undefined' ? errcode : 2
    gutil.log(`Manual exit with error code ${errcode}...`)
    process.exit(errcode)
  },

  _lintGiven(fileIds) {
    fileIds = fileIds.filter(file => file.endsWith('.js'))
    return gulp.src(fileIds)
      .pipe(eslint())
      .pipe(eslint.format())
      .pipe(eslint.failAfterError())
  },

  lintjs() {
    return gulp.src([
        'gulpfile.babel.js',
        'src/**/*.js',
        'tests/**/*.js'
      ])
      .pipe(eslint())
      .pipe(eslint.format())
      .pipe(eslint.failAfterError())
  },

  test() {
    // No need to read file contents as mocha needs file paths only
    return gulp.src('tests/*.js', {read: false})
    .pipe(mocha())
    // Gulp watch requires end event to prevent watch from ending process/task
    .on('error', function(err) {
      gutil.log(c.red('Error: ') + c.yellow(err.message) + '\n' + err.stack)
      this.emit('end')
    })
  }
}

// ----------------------------------------
// GULP TASKS
// ----------------------------------------
Object.keys(tasks)
  .filter(key => key[0] !== '_')
  .forEach(key => {
    const fn = tasks[key].bind(tasks)
    tasks[key] = () => {
      gutil.log(`--> '${key}'`)
      const result = fn()
      if (result && result.on) {
        return result.on('end', () => gutil.log(`<-- '${key}'`))
      }
      return result
    }
    gulp.task(key, () => tasks[key]())
  })

gulp.task('default', () => {
  bundler.plugin(watchify)
  gulp.watch('tests/*.js', ['test'])
  tasks.clean().then(() => {
    tasks.copy()
    tasks.bundle()
    tasks.browserSync()
  })
  gutil.log('Watching for changes...')
})
gulp.task('build', done => {
  tasks.test().on('error', err => tasks.die(1))
  tasks.lintjs().on('error', err => tasks.die(1))
  tasks.browserify().on('error', err => tasks.die(1))
})

gulp.task('test-watch', function() {
  tasks.lintjs().on('error', () => {
    this.emit('end')
  }).on('end', () => {
    tasks.test()
  })
  gulp.watch(['src/**/*.js', 'tests/**/*.js'], ['lintjs', 'test'])
})

// ----------------------------------------
// BROWSERIFY CONFIG
// ----------------------------------------
var bundler = browserify({
  cache: {},
  debug: true,
  entries: ['src/Revir.js'],
  packageCache: {},
  // Browserify has issues with relative paths in ES6 modules. To allow import
  // 'a' instead of import './a', we need to declare all paths where code may
  // live. Edit: paths doesn't help when multiple directories are invovled.
  //paths: ['src/', 'test/'],
  transform: [babelify]
})
// Update triggered from watchify
.on('update', tasks.bundle)
.on('log', msg => gutil.log(`log: ${msg}`))
.on('error', function(err) {
  gutil.log('Error: ' + err.message)
  browserSync.notify('Browserify Error!')
  this.emit('end')
})
