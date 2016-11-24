
'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var openURL = require('open');
var lazypipe = require('lazypipe');
var rimraf = require('rimraf');
var wiredep = require('wiredep').stream;
var runSequence = require('run-sequence');

var yeoman = {
  app: require('./bower.json').appPath || 'app',
  tmp: '.tmp',
  dist: 'dist'
};

var paths = {
  jade:[yeoman.app + '/**/*.jade'],
  scripts: [yeoman.app + '/scripts/**/*.coffee'],
  styles: [yeoman.app + '/styles/**/*.scss'],
  test: ['test/spec/**/*.coffee'],
  testRequire: [
    yeoman.app + '/bower_components/angular/angular.js',
    yeoman.app + '/bower_components/angular-mocks/angular-mocks.js',
    yeoman.app + '/bower_components/angular-resource/angular-resource.js',
    yeoman.app + '/bower_components/angular-cookies/angular-cookies.js',
    yeoman.app + '/bower_components/angular-sanitize/angular-sanitize.js',
    yeoman.app + '/bower_components/angular-route/angular-route.js',
    'test/mock/**/*.coffee',
    'test/spec/**/*.coffee'
  ],
  karma: 'karma.conf.js',
  views: {
    main: yeoman.tmp + '/index.html',
    files: [yeoman.tmp + '/views/**/*.html']
  }
};

////////////////////////
// Reusable pipelines //
////////////////////////

var lintScripts = lazypipe()
  .pipe($.coffeelint)
  .pipe($.coffeelint.reporter);

var styles = lazypipe()
  .pipe($.sass, {
    outputStyle: 'expanded',
    precision: 10
  })
  .pipe($.autoprefixer, 'last 1 version')
  .pipe(gulp.dest, '.tmp/styles');

///////////
// Tasks //
///////////

gulp.task('styles', function () {
  return gulp.src(paths.styles)
    .pipe(styles());
});

gulp.task('coffee', function() {
  return gulp.src(paths.scripts)
    .pipe(lintScripts())
    .pipe($.coffee({bare: true}).on('error', $.util.log))
    .pipe(gulp.dest('.tmp/scripts'));
});

gulp.task('jade', function() {
  gulp.src(paths.jade)
    .pipe($.jade())
    .pipe($.prettify({ indent_size: 2, unformatted: ['pre', 'code'] }))
    .pipe(gulp.dest(yeoman.tmp))
});

gulp.task('lint:scripts', function () {
  return gulp.src(paths.scripts)
    .pipe(lintScripts());
});

gulp.task('clean:tmp', function (cb) {
  rimraf('./' + yeoman.tmp, cb);
});

gulp.task('start:client', ['start:server', 'coffee','jade','styles'], function () {
  openURL('http://localhost:9000');
});

gulp.task('start:server', function() {
  $.connect.server({
    root: [yeoman.app, yeoman.tmp],
    livereload: true,
    // Change this to '0.0.0.0' to access the server from outside.
    port: 9000
  });
});

gulp.task('start:server:test', function() {
  $.connect.server({
    root: ['test', yeoman.app, yeoman.tmp],
    livereload: true,
    port: 9001
  });
});

gulp.task('watch', function () {
  //watch styles
  $.watch(paths.styles)
    .pipe($.plumber())
    .pipe(styles())
    .pipe($.connect.reload());

  //watch coffee
  $.watch(paths.scripts)
    .pipe($.plumber())
    .pipe(lintScripts())
    .pipe($.coffee({bare: true}).on('error', $.util.log))
    .pipe(gulp.dest(yeoman.tmp + '/scripts'))
    .pipe($.connect.reload());

  //watch jade
  $.watch(paths.jade)
    .pipe($.plumber())
    .pipe($.jade())
    .pipe(gulp.dest(yeoman.tmp))
    .pipe($.connect.reload());

  $.watch(paths.test)
    .pipe($.plumber())
    .pipe(lintScripts());

  //watch Bower
  gulp.watch('bower.json', ['bower']);
});

gulp.task('serve', function (cb) {
  runSequence('clean:tmp',
    ['lint:scripts'],
    ['start:client'],
    'watch', cb);
});

gulp.task('serve:prod', function() {
  $.connect.server({
    root: [yeoman.dist],
    livereload: true,
    port: 9000
  });
});

gulp.task('test', ['start:server:test'], function () {
  var testToFiles = paths.testRequire.concat(paths.scripts, paths.test);
  return gulp.src(testToFiles)
    .pipe($.karma({
      configFile: paths.karma,
      action: 'watch'
    }));
});

// inject bower components
gulp.task('bower', function () {
  return gulp.src(paths.views.main)
    .pipe(wiredep({
      directory: yeoman.app + '/bower_components',
      ignorePath: '..'
    }))
  .pipe(gulp.dest(yeoman.app));
});

///////////
// Build //
///////////

gulp.task('clean:dist', function (cb) {
  rimraf('./dist', cb);
});

//image min
gulp.task('images', function () {
  return gulp.src(yeoman.app + '/images/**/*')
    .pipe($.cache($.imagemin({
      optimizationLevel: 5,
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest(yeoman.dist + '/images'));
});

//copy fonts
gulp.task('copy:fonts', function () {
  return gulp.src([yeoman.app + '/fonts/**/*',yeoman.app + '/bower_components/bootstrap/fonts/**/*'])
    .pipe(gulp.dest(yeoman.dist + '/fonts'));
});

//copy html,js,css
gulp.task('html', ['jade','coffee','styles'] ,function () {
  return gulp.src([
      yeoman.tmp + '/**/*.html',
      '!' + yeoman.tmp + '/index.html',
      yeoman.app + '/**/*.html',
      yeoman.app + '/*.ico',yeoman.app + '/*.txt'
    ])
    .pipe(gulp.dest(yeoman.dist));
});

//js，css min
gulp.task('client:build', ['html'], function () {
  var jsFilter = $.filter('**/*.js');
  var cssFilter = $.filter('**/*.css');

  return gulp.src(paths.views.main)
    .pipe($.useref({searchPath: [yeoman.app, yeoman.tmp]}))
    .pipe(jsFilter)
    .pipe($.ngAnnotate())
    .pipe($.uglify())
    .pipe(jsFilter.restore())
    .pipe(cssFilter)
    .pipe($.minifyCss({cache: true}))
    .pipe(cssFilter.restore())
    .pipe(gulp.dest(yeoman.dist));
});


//publish
gulp.task('build', ['clean:tmp','clean:dist'], function () {
  runSequence(['images','copy:fonts', 'client:build']);
});

gulp.task('server', ['serve']);
gulp.task('default', ['build']);
