'use strict';

const h = require('virtual-dom/h');
const diff = require('virtual-dom/diff');
const patch = require('virtual-dom/patch');
const createElement = require('virtual-dom/create-element');
const {$} = require('./dollar');
const OS = require('./os');
const {RegisterKeyBindings} = require('./keybindings');
const {read:guessURL} = require('./url-helper');

var gTabtree = null;
var vTree = null;
var rootNode = null;

function init(parent, tabtree) {
  if (!!gTabtree) {
    throw new Error('already initialized');
  }
  gTabtree = tabtree;
  vTree = render();
  rootNode = createElement(vTree);
  parent.appendChild(rootNode);

  tabtree.on('tree-layout-changed', scheduleDOMUpdate);
  tabtree.on('selected-tab-changed', scheduleDOMUpdate);
  tabtree.on('tab-update', scheduleDOMUpdate);

  setupKeybindings();

  /*var urlbox = $('.navbar-urlbox');
  var input = $('.navbar-urlbox-input');

  urlbox.addEventListener('click', focusAndSelectInput);
  input.addEventListener('focus', _ => urlbox.classList.add('input-focus'));
  input.addEventListener('blur', _ => urlbox.classList.remove('input-focus'));
  input.addEventListener('keyup', e => {
    if (e.keyCode == 27) {
      // Escape
      input.blur()
    }
    if (e.keyCode == 13) {
      var url = guessURL(input.value);
      gTabtree.getSelectedTab().setLocation(url);
      input.blur();
    }
  });
 */

}

function focusAndSelectInput() {
  var input = $('.navbar-urlbox-input');
  input.focus();
  if (input.setSelectionRange) { // Servo doesn't support it yet
    input.setSelectionRange(0, input.value.length);
  }
}

function uninit() {
  if (!gTabtree) {
    throw new Error('not initialized');
  }
  gTabtree.off('tree-layout-changed', scheduleDOMUpdate);
  gTabtree.off('selected-tab-changed', scheduleDOMUpdate);
  gTabtree.off('tab-update', scheduleDOMUpdate);
  gTabtree = null;
}

var DOMUpdateScheduled = false;

function scheduleDOMUpdate() {
  if (!DOMUpdateScheduled) {
    window.requestAnimationFrame(function() {
      var s0 = window.performance.now();
      DOMUpdateScheduled = false;
      var newTree = render();
      var patches = diff(vTree, newTree);
      vTree = newTree;
      rootNode = patch(rootNode, patches);
      var s1 = window.performance.now();
      // console.log("rendering: " + Math.round(s1 - s0) + "ms");
    });
    DOMUpdateScheduled = true;
  }
}

function render() {
  var tabbar = renderTabbar();
  var navbar = renderNavbar();
  return h('div.toolbox', [tabbar, navbar]);
}

function renderTabbar() {
  var children = [];
  var sIdx = 0;
  var foundSelected = false;
  gTabtree.root.walk(n => {
    if (!n.tab) return; // root
    var tab = n.tab;

    var title =
      tab.empty ? 'New tab' :
      tab.title ? tab.title :
      tab.loading ? 'Loading…' :
      tab.location;

    children.push(h('div.tab', {
      className: tab.selected ? 'selected' : '',
    }, [
      tab.loading ?
        h('div.tab-spinner', '\uf29C') :
        h('img.tab-favicon', {src: tab.favicon, alt: ''}),
      h('span.tab-title', title),
      h('span.tab-close', '\uf2d7'),
    ]));

    if (!foundSelected) {
      if (tab.selected) {
        foundSelected = true;
      } else {
        sIdx++;
      }
    }
  });

  var shadowTab = h('div', {
    style: {
      transform: `translateX(${150 * sIdx}px)`
    },
    className: 'tab-shadow meh' + sIdx,
  }, [
    h('div.tab-shadow-start'),
    h('div.tab-shadow-middle'),
    h('div.tab-shadow-end'),
  ])

  return h('div.tabbar', [shadowTab, ...children]);

}


function renderNavbar() {
  var tab = gTabtree.getSelectedTab();

  var urlStr = tab.location;

  var protocol = 'a';
  var hostname = 'b';
  var path = 'c';

  if (urlStr) {
    var urlObj = new URL(urlStr);
    protocol = urlObj.protocol + '//';
    hostname = urlObj.hostname;
    path = urlObj.path;
  }

  return h('div.navbar', [
    h('span.navbar-button', '\uF2CA'),
    h('span.navbar-button', '\uF30F'),
    h('span.navbar-button', '\uF3A8'),
    h('div.navbar-urlbox', [
      h('input.navbar-urlbox-input', {
        type: 'text',
        value: 'abc'
      }),
      h('p.navbar-urlbox-prettyurl', [
        h('span.navbar-urlbox-prettyurl-protocol', protocol),
        h('span.navbar-urlbox-prettyurl-hostname', hostname),
        h('span.navbar-urlbox-prettyurl-path', path),
      ])
    ]),
    h('span.navbar-button', '\uF442'),
    h('span.navbar-button', '\uF397'),
  ]);
}

function setupKeybindings() {
  if (OS == 'x11' || OS == 'win') {
    RegisterKeyBindings(
      ['Ctrl',     'l',    focusAndSelectInput]
    );
  }

  if (OS == 'mac') {
    RegisterKeyBindings(
      ['Cmd',      'l',    focusAndSelectInput]
    );
  }
}


exports.init = init;
exports.uninit = uninit;
