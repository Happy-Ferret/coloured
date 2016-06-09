'use strict';

const h = require('virtual-dom/h');
const diff = require('virtual-dom/diff');
const patch = require('virtual-dom/patch');
const createElement = require('virtual-dom/create-element');
const {$} = require('./dollar');
const EventEmitter = require('event-emitter');

var Logs = {
  _times: [],
  _logs: [],
  renderingTime: function(value) {
    var warn = value > 15;
    value = Math.round(value);
    this._times.push({value, warn});
    this.emit('newlog');
  },
  log: function(value, level="log") {
    console.log(level + ": "  + value);
    this._logs.push({value, level});
    this.emit('newlog');
  },
}
EventEmitter(Logs);
exports.Logs = Logs;

function init() {
  var vtree = renderLogs(Logs);
  var vnode = createElement(vtree);
  var vdom  = {vtree, vnode, DOMUpdateScheduled: false};
  $('.notab').appendChild(vdom.vnode);
  Logs.on('newlog', () => scheduleDOMUpdate(Logs, vdom));
}

function scheduleDOMUpdate(model, vdom) {
  if (!vdom.DOMUpdateScheduled) {
    setTimeout(function() { // We should use request animation frame, but I don't want to mess up with the main rendering loop
      vdom.DOMUpdateScheduled = false;
      var newTree = renderLogs(model);
      var patches = diff(vdom.vtree, newTree);
      vdom.vtree = newTree;
      vdom.vnode = patch(vdom.vnode, patches);
    }, 2000);
    vdom.DOMUpdateScheduled = true;
  }
}

function renderLogs(Logs) {
  return h("div", [
    // h('ul#logs', Logs._logs.map(log => h("li", {className: log.level}, log.value))),
    // h('ul#rendering-time', Logs._times.map(t => h("li", {className: t.warn ? "warn":""}, t.value))),
  ]);
}

init();
