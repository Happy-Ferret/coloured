'use strict';

const h = require('virtual-dom/h');
const diff = require('virtual-dom/diff');
const patch = require('virtual-dom/patch');
const createElement = require('virtual-dom/create-element');
const Delegator = require('dom-delegator'); // FIXME: REMOVE?
const {TabTree} = require('./tabtree');
const OS = require('./os');
const {RegisterKeyBindings} = require('./keybindings');
const {read:guessURL} = require('./url-helper');
const {$} = require('./dollar');
const {Logs} = require('./logs');

Logs.log("start");

const LOG_RENDER_TIME = true;

var native_theme = true;
const NATIVE_THEME_URL = "./css/theme-native.css";

function init() {
  var tabtree = new TabTree($('.iframes'));
  setupGlobalKeybindings(tabtree);
  var vtree = renderToolbox(tabtree);
  var vnode = createElement(vtree);
  var vdom  = { vtree, vnode, DOMUpdateScheduled: false };
  $('.toolbox-container').appendChild(vdom.vnode);
  tabtree.on('tree-layout-changed', () => scheduleDOMUpdate(tabtree, vdom));
  tabtree.on('selected-tab-changed', () => scheduleDOMUpdate(tabtree, vdom));
  tabtree.on('tab-update', () => scheduleDOMUpdate(tabtree, vdom));
}

function onInputKeyUp(e, tabtree) {
  var input = e.currentTarget;
  var tab = tabtree.getSelectedTab(); // FIXME: slow
  if (e.keyCode == 27) { // Escape
    tab.userInputFocused = false;
  } else if (e.keyCode == 13) { // Enter
    var url = guessURL(input.value);
    tab.setLocation(url);
    tab.userInputFocused = false;
  } else {
    // tab.userInput = input.value;
  }
}

function focusAndSelectInput(tabtree) {
  tabtree.getSelectedTab().userInputFocused = true;
  var input = $('.navbar-urlbox-input');
  if (input.setSelectionRange) { // Servo doesn't support it yet
    input.setSelectionRange(0, input.value.length);
  }
}

function scheduleDOMUpdate(tabtree, vdom) {
  if (!vdom.DOMUpdateScheduled) {
    requestAnimationFrame(function() {
      var s0 = window.performance.now();
      vdom.DOMUpdateScheduled = false;
      var newTree = renderToolbox(tabtree);
      var patches = diff(vdom.vtree, newTree);
      vdom.vtree = newTree;
      vdom.vnode = patch(vdom.vnode, patches);

      // After DOM update. Things we don't want to do with
      // the virtual DOM
      var tab = tabtree.getSelectedTab();
      var input = $('.navbar-urlbox-input');
      if (tab.userInputFocused) {
        input.focus();
      } else {
        input.blur();
      }
      input.value = tab.userInput;

      var s1 = window.performance.now();
      if (LOG_RENDER_TIME) {
        Logs.renderingTime(s1 - s0);
      }
    });
    vdom.DOMUpdateScheduled = true;
  }
}

function renderToolbox(tabtree) {
  var tabbar = renderTabbar(tabtree);
  var navbar = renderNavbar(tabtree);
  return h('div.toolbox', [tabbar, navbar]);
}

function renderTabbar(tabtree) {
  var children = [];
  var sIdx = 0;
  var foundSelected = false;

  tabtree.root.walk(n => {
    if (!n.tab) return; // root
    var tab = n.tab;

    var title =
      tab.empty ? 'New tab' :
      tab.title ? tab.title :
      tab.loading ? 'Loading…' :
      tab.location;

    children.push(h('div.tab', {
      className: tab.selected ? 'selected' : '',
      dataset: {
        'tabid': tab.id,
      },
      onclick: e => onTabClicked(e, tabtree),
    }, [
      tab.loading ?
        h('div.tab-spinner', '\uf29C') :
        h('div.tab-favicon-wrapper', [h('div.tab-favicon', {
          style: {
            backgroundImage: 'url(' + tab.favicon + ')'
          }, alt: ''})]),
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

  var controls = h('div.window-controls', [
    h('div.window-control.window-control-close'),
    h('div.window-control.window-control-min'),
    h('div.window-control.window-control-max'),
  ]);

  var shadowTab = h('div', {
    style: {
      transform: `translateX(${150 * sIdx}px)`
    },
    className: 'tab-shadow'
  }, [
    h('div.tab-shadow-start'),
    h('div.tab-shadow-middle'),
    h('div.tab-shadow-end'),
  ])

  return h('div.tabbar', [controls, shadowTab, ...children]);
}

function onTabClicked(e, tabtree) {
  var tabID = e.currentTarget.dataset.tabid;
  var tab = tabtree.getTabByID(tabID);
  if (!tab) {
    throw new Error(`Can't find tab ${tabID}`);
  }
  tabtree.selectTab(tab);
}

function renderNavbar(tabtree) {
  var tab = tabtree.getSelectedTab();

  var urlStr = tab.location;

  var protocol = '';
  var hostname = '';
  var rest = '';

  if (urlStr) {
    var urlObj = new URL(urlStr);
    protocol = urlObj.protocol + '//';
    hostname = urlObj.hostname;
    rest = urlObj.pathname + urlObj.search + urlObj.hash;
  } else {
    rest = tab.userInput;
  }

  return h('div.navbar', [
    h('span.navbar-button', { onclick: () => tabtree.getSelectedTab().goBack() }, '\uF2CA'),
    h('span.navbar-button', { onclick: () => tabtree.getSelectedTab().goForward() }, '\uF30F'),
    h('span.navbar-button', { onclick: () => tabtree.getSelectedTab().reload() }, '\uF3A8'),
    h('div.navbar-urlbox', {
      className: (tab.userInputFocused ? 'input-focused' : '') + ' security-state-' + tab.securityState,
      onclick: () => focusAndSelectInput(tabtree),
    }, [
      h('input.navbar-urlbox-input', {
        onblur: () => tabtree.getSelectedTab().userInputFocused = false,
        onfocus: () => tabtree.getSelectedTab().userInputFocused = true,
        onkeyup: (e) => onInputKeyUp(e, tabtree),
        type: 'text',
      }),
      h('p.navbar-urlbox-prettyurl', [
        h('span.navbar-urlbox-prettyurl-protocol', protocol),
        h('span.navbar-urlbox-prettyurl-hostname', hostname),
        h('span.navbar-urlbox-prettyurl-pathname', rest),
      ])
    ]),
    h('span.navbar-button', '\uF442'),
    h('span.navbar-button', {
      onclick: () => {
        native_theme = !native_theme;
        if (native_theme) {
          document.querySelector("#theme").href = NATIVE_THEME_URL;
        } else {
          document.querySelector("#theme").href = "";
        }
      },
    },'\uF397'),
  ]);
}

function setupGlobalKeybindings(tabtree) {
  RegisterKeyBindings(
    ['',              'Esc',          () => tabtree.getSelectedTab().stop()],
    ['Ctrl',          'Tab',          () => tabtree.selectNextTab()],
    ['Ctrl Shift',    'code:9',       () => tabtree.selectPrevTab()]
  );
  if (OS == 'x11' || OS == 'win') {
    RegisterKeyBindings(
      ['Ctrl',          'l',          () => focusAndSelectInput(tabtree)],
      ['Ctrl',          't',          () => tabtree.addTab({selected: true, userInputFocused: true})],
      ['Ctrl',          'r',          () => tabtree.getSelectedTab().reload()],
      ['Alt',           'Left',       () => tabtree.getSelectedTab().goBack()],
      ['Alt',           'Right',      () => tabtree.getSelectedTab().goForward()],
      ['Ctrl',          'w',          () => tabtree.dropTabAndMoveChildrenUp(tabtree.getSelectedTab())],
      ['Ctrl Shift',    '+',          () => tabtree.getSelectedTab().zoomIn()],
      ['Ctrl',          '=',          () => tabtree.getSelectedTab().zoomIn()],
      ['Ctrl',          '-',          () => tabtree.getSelectedTab().zoomOut()],
      ['Ctrl',          '0',          () => tabtree.getSelectedTab().resetZoom()]
    );
  }
  if (OS == 'mac') {
    RegisterKeyBindings(
      ['Cmd',       'l',              () => focusAndSelectInput(tabtree)],
      ['Cmd',       't',              () => tabtree.addTab({selected: true, userInputFocused: true})],
      ['Cmd',       'r',              () => tabtree.getSelectedTab().reload()],
      ['Cmd',       'Left',           () => tabtree.getSelectedTab().goBack()],
      ['Cmd',       'Right',          () => tabtree.getSelectedTab().goForward()],
      ['Cmd',       'w',              () => tabtree.dropTabAndMoveChildrenUp(tabtree.getSelectedTab())],
      ['Cmd Shift', '+',              () => tabtree.getSelectedTab().zoomIn()],
      ['Cmd',       '=',              () => tabtree.getSelectedTab().zoomIn()],
      ['Cmd',       '-',              () => tabtree.getSelectedTab().zoomOut()],
      ['Cmd',       '0',              () => tabtree.getSelectedTab().resetZoom()]
    );
  }
}

function enableDevtools() {
  navigator.mozSettings.createLock().set({
    "debugger.remote-mode": "adb-devtools",
  });
}

init();
