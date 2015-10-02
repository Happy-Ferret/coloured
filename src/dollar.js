'use strict';

exports.$ = (...args) => document.querySelector(...args);
exports.$$ = (...args) => document.querySelectorAll(...args);
