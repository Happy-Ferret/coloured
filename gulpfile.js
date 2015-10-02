'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');
var watchify = require('watchify');
var http = require('http');
var ecstatic = require('ecstatic');
var path = require('path');
var rename = require('gulp-rename');

var settings = {
  cache: {},
  packageCache: {},
  /*
  compression: {
    mangle: true,
    compress: true,
    acorn: true
  }
 */
  compression: null
};

gulp.task('script', function() {

  var bundle = browserify({
    entries: ['src/index'],
    debug: true,
    cache: settings.cache,
    packageCache: settings.packageCache
  }).bundle()
    .on('error', gutil.log)
    .pipe(source('src/index.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .on('error', gutil.log);

  (settings.compression ? bundle.pipe(uglify(settings.compression)) : bundle)
    .on('error', gutil.log)
    .pipe(rename('index.js'))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('copy', function() {
  gulp.src('./src/index.html').pipe(gulp.dest('./dist/'));
  gulp.src('./manifest.webapp').pipe(gulp.dest('./dist/'));
  gulp.src('./src/css/*').pipe(gulp.dest('./dist/css/'));
});

gulp.task('watch', function() {
  gulp.watch('src/**', ['build']);
});

gulp.task('server', function() {
  var server = http.createServer(ecstatic({
    root: path.join(module.filename, '../dist'),
    cache: 0
  }));
  server.listen(6060);
});

gulp.task('default',      ['build']);
gulp.task('build',        ['script', 'copy']);
gulp.task('build-server', ['watch', 'build', 'server'])
