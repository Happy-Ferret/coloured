'use strict';

const EventEmitter = require('event-emitter');
const AllOff = require('event-emitter/all-off');
const {getFallback, getBestIcon} = require('./favicon');
const OS = require('./os');

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

const HOMEPAGE = 'http://mozilla.com';

function TabTree(parentDOMNode) {
  EventEmitter(this);
  this._root = new TreeNode();

  this._onMozBrowserOpenWindow = this._onMozBrowserOpenWindow.bind(this);
  this._onMozBrowserOpenTab = this._onMozBrowserOpenTab.bind(this);
  this._onTabUpdate = this._onTabUpdate.bind(this);

  this._parentDOMNode = parentDOMNode;
  this.restoreSession();
}

exports.TabTree = TabTree;

TabTree.prototype = {

  toString: function() {
    var string = '';
    this._root.walk(n => {
      if (n.tab) {
        var depth = n.getDepth();
        var spaces = '';
        while (depth--) spaces += '   ';
        string += '\n' + (n.tab.selected ? '[*]' : '[ ]');
        string += spaces + n.tab.toString();
      }
    });
    return string;
  },

  get root() {
    return this._root;
  },

  saveSession: function() {
  },

  restoreSession: function() {
    // FIXME
    this.addTab({url: HOMEPAGE});
    return;
  },

  _getTreeNode: function(tab) {
    var node = this._root.find(n => n.tab === tab);
    if (!node) {
      throw new Error("Can't find node for tab");
    }
    return node;
  },

  _onMozBrowserOpenWindow: function(iframeEvent, tab) {
    this.addTab({
      url: iframeEvent.detail.url,
      frameElement: iframeEvent.detail.frameElement,
      parentTab: tab,
      selected: true,
    });
  },

  _onMozBrowserOpenTab: function(iframeEvent, tab) {
    this.addTab({
      url: iframeEvent.detail.url,
      frameElement: iframeEvent.detail.frameElement,
      parentTab: tab,
      selected: false,
    });
  },

  _onTabUpdate: function(tab) {
    this.emit('tab-update', tab);
  },

  addTab: function(options={}) {

    var tab = new Tab(this._parentDOMNode, {
      frameElement: options.frameElement, // FIXME: test if frameElement actually works
    });

    if (options.userInputFocused) {
      tab.userInputFocused = true;
    }
    
    var treeNode = new TreeNode(tab);

    var treeWasEmpty = this._root.children.length == 0;

    var treeParent = this._root;
    if (options.parentTab) {
      treeParent = this._getTreeNode(options.parentTab);
    }

    treeParent.appendChild(treeNode);

    tab.on('mozbrowseropenwindow', this._onMozBrowserOpenWindow);
    tab.on('mozbrowseropentab', this._onMozBrowserOpenTab);
    tab.on('tab-update', this._onTabUpdate);

    if (options.url) {
      tab.setLocation(options.url);
    }

    if (treeWasEmpty || options.selected) {
      this.selectTab(tab);
    } else {
      tab.selected = false;
    }

    this.emit('tree-layout-changed');

    return tab;
  },

  dropTabAndChildren: function(tab) {
    var node = this._getTreeNode(tab);

    // FIXME: should use getNextTab
    if (node.find(n => n.tab.selected)) {
      this.selectTab(node.lastNode().nextNode().tab);
    }

    node.detach();
    node.walk(n => {
      n.tab.destroy();
      n.tab = null;
    });
    this.emit('tree-layout-changed');
  },

  dropTabAndMoveChildrenUp: function(tab) {
    var node = this._getTreeNode(tab);
    if (node.isRoot()) {
      throw new Error("Can't drop root node");
    }

    if (tab.selected) {
      this.selectTab(node.nextNode().tab);
    }

    var count = node.children.length;
    for (var i = count - 1; i >= 0; i--) {
      var child = node.children[i];
      node.parent.appendChildAfter(child, node);
    }
    node.detach();
    node.tab = null;

    tab.destroy();

    this.emit('tree-layout-changed');
  },

  moveTabAndChildrenAfter: function(tab, prevTab) {
    var node = this._getTreeNode(tab);
    var prevNode = this._getTreeNode(prevTab);

    var isPrevTabInTab = node.find(n => n == prevNode);
    if (isPrevTabInTab) {
      throw new Error("Illegal move");
    }

    prevNode.parent.appendChildAfter(node, prevNode);
    this.emit('tree-layout-changed');
  },

  selectTab: function(tab) {
    var previouslySelected = this.getSelectedTab();
    if (previouslySelected === tab) {
      return;
    }
    if (previouslySelected) {
      previouslySelected.selected = false;
    }
    tab.selected = true;
    this.emit('selected-tab-changed');
  },

  selectNextTab: function() {
    var previouslySelected = this.getSelectedTab();
    this.selectTab(this.getNextTabAndLoop(previouslySelected));
  },

  selectPrevTab: function() {
    var previouslySelected = this.getSelectedTab();
    this.selectTab(this.getPreviousTabAndLoop(previouslySelected));
  },

  getFirstTab: function() {
    return this._root.children[0].tab;
  },

  getLastTab: function() {
    return this._root.lastNode().tab;
  },

  getPreviousTab: function(tab) {
    var node = this._getTreeNode(tab);
    var prevNode = node.prevNode();
    return prevNode ? prevNode.tab : null;
  },

  getPreviousTabAndLoop: function(tab) {
    var prevTab = this.getPreviousTab(tab);
    if (!prevTab) {
      prevTab = this.getLastTab();
    }
    return prevTab;
  },

  getNextTab: function(tab) {
    var node = this._getTreeNode(tab);
    var nextNode = node.nextNode();
    return nextNode ? nextNode.tab : null;
  },

  getNextTabAndLoop: function(tab) {
    var nextTab = this.getNextTab(tab);
    if (!nextTab) {
      nextTab = this.getFirstTab();
    }
    return nextTab;
  },

  getTabByID: function(id) {
    var node = this._root.find(n => n.tab && n.tab.id == id);
    if (!node) {
      return null;
    }
    return node.tab;
  },

  getSelectedTab: function() {
    var node = this._root.find(n => n.tab && n.tab.selected);
    if (!node) {
      return null;
    }
    return node.tab;
  },

}

/**               TAB                 **/


const IFRAME_EVENTS = [
  'mozbrowserasyncscroll', 'mozbrowserclose', 'mozbrowsercontextmenu',
  'mozbrowsererror', 'mozbrowsericonchange', 'mozbrowserloadend',
  'mozbrowserloadstart', 'mozbrowserlocationchange', 'mozbrowseropentab',
  'mozbrowseropenwindow', 'mozbrowsersecuritychange', 'mozbrowsershowmodalprompt',
  'mozbrowsertitlechange', 'mozbrowserusernameandpasswordrequired'
];


var sId = 0;

function Tab(parentDOMNode, options={}) {
  this._url = options.url;
  if (!parentDOMNode) {
    throw new Error('parentDOMNode required');
  }
  var div = document.createElement('div');
  parentDOMNode.appendChild(div);
  this._id = 'tab-' + sId++;
  this._div = div;
  this._div.className = 'tabiframe';
  this._zoom = 1;
  this._userInput = '';
  this._userInputFocused = false;
  this._clearTabtab();
  if (options.frameElement) {
    this._createInnerIframe(options.frameElement);
  }
  EventEmitter(this);
}

Tab.prototype = {

  toString: function() {
    return 'Tab: ' + this._url;
  },

  get id() {
    return this._id;
  },

  set selected(value) {
    this._selected = value;
    if (this._selected) {
      this._show();
    } else {
      this._hide();
    }
  },

  get selected() {
    return this._selected;
  },

  destroy: function() {
    if (this._innerIframe) {
      for (var eventName of IFRAME_EVENTS) {
        this._innerIframe.removeEventListener(eventName, this);
      }
    }
    this.treeNode = null;
    this._div.remove();
    this.emit('destroyed');
    AllOff(this);
  },

  _show() {
    this._div.classList.add('tabiframe-visible');
    safeIframeCall(this._innerIframe, 'setVisible', true)
  },

  _hide() {
    this._div.classList.remove('tabiframe-visible');
    safeIframeCall(this._innerIframe, 'setVisible', false)
  },

  setLocation(url) {
    this._location = url;
    if (!this._innerIframe) {
      this._createInnerIframe();
    }
    this._innerIframe.src = url;
  },

  zoomIn() {
    this._zoom += 0.1;
    this._zoom = Math.min(MAX_ZOOM, this._zoom);
    this._applyZoom();
  },

  zoomOut() {
    this._zoom -= 0.1;
    this._zoom = Math.max(MIN_ZOOM, this._zoom);
    this._applyZoom();
  },

  resetZoom() {
    this._zoom = 1;
    this._applyZoom();
  },

  reload() {
    safeIframeCall(this._innerIframe, 'reload')
  },

  stop() {
    safeIframeCall(this._innerIframe, 'stop')
  },

  goBack() {
    safeIframeCall(this._innerIframe, 'goBack')
  },

  goForward() {
    safeIframeCall(this._innerIframe, 'goForward')
  },

  canGoBack() {
    // FIXME: should not be a promise. This should be updated
    // when getting the location update
    /*
    return new Promise((resolve, reject) => {
      if (!this._innerIframe) {
        return resolve(false);
      }
      this._innerIframe.getCanGoBack().onsuccess = r => {
        return resolve(r.target.result);
      };
    });
   */
  },

  canGoForward() {
    /* FIXME see canGoBack
    return new Promise((resolve, reject) => {
      if (!this._innerIframe) {
        return resolve(false);
      }
      this._innerIframe.getCanGoForward().onsuccess = r => {
        return resolve(r.target.result);
      };
    });
   */
  },

  focus() {
    safeIframeCall(this._innerIframe, 'focus')
  },

  get empty() {
    return !this._innerIframe;
  },

  get userInput() {
    return this._userInput;
  },

  set userInput(val) {
    if (this._userInput != val) {
      this._userInput = val;
      this.emit('tab-update', this);
    }
  },

  get userInputFocused() {
    return this._userInputFocused;
  },

  set userInputFocused(val) {
    if (this._userInputFocused != val) {
      this._userInputFocused = val;
      this.emit('tab-update', this);
    }
  },

  get loading() {
    return this._loading;
  },

  get title() {
    return this._title;
  },

  get location() {
    return this._location;
  },

  get favicon() {
    return this._faviconURL || getFallback(this.location);
  },

  get securityState() {
    return this._securityState;
  },

  get securityExtendedValidation() {
    return this._securityExtendedValidation;
  },

  _createInnerIframe(iframe) {

    if (!iframe) {
      iframe = document.createElement('iframe');
    }

    iframe.setAttribute('mozbrowser', 'true');
    iframe.setAttribute('remote', 'true');
    iframe.setAttribute('mozallowfullscreen', 'true');
    iframe.setAttribute('tabindex', '-1');

    this._div.appendChild(iframe);

    for (var eventName of IFRAME_EVENTS) {
      iframe.addEventListener(eventName, this);
    }

    this._innerIframe = iframe;
    this._applyZoom();
  },

  _applyZoom() {
    safeIframeCall(this._innerIframe, 'zoom', this._zoom)
  },

  _clearTabtab() {
    this._loading = false;
    this._title = '';
    this._location = '';
    this._bestIcon = null;
    this._securityState = 'insecure';
    this._securityExtendedValidation = false;
  },

  handleEvent(e) {

    // console.log('TABEVENT', e.type);

    var somethingChanged = true;

    switch (e.type) {
      case 'mozbrowserloadstart':
        this._clearTabtab();
        this._loading = true;
        break;
      case 'mozbrowserloadend':
        this._loading = false;
        break;
      case 'mozbrowsertitlechange':
        this._title = e.detail;
        break;
      case 'mozbrowserlocationchange':
        this.userInput = '';
        this._location = e.detail;
        break;
      case 'mozbrowsericonchange':
        var {bestIcon, faviconURL} = getBestIcon([e.detail, this._bestIcon]);
        this._faviconURL = faviconURL;
        this._bestIcon = bestIcon;
        break;
      case 'mozbrowsererror':
        this._loading = false;
        break;
      case 'mozbrowsersecuritychange':
        this._securityState = e.detail.state;
        this._securityExtendedValidation = e.detail.extendedValidation;
        break;
      default:
        somethingChanged = false;
    }

    if (somethingChanged) {
      this.emit('tab-update', this);
    }

    switch (e.type) {
      case 'mozbrowseropenwindow':
      case 'mozbrowseropentab':
        this.emit(e.type, e, this);
    }

  },

}


/**               A TREE STRUCTURE                **/


function TreeNode(tab) {
  this._parent = null;
  this._children = [];
  this.tab = tab;
}

TreeNode.prototype = {

  get _siblings() {
    if (!this._parent) {
      throw new Error("Can't get sibling of root node");
    }
    return this._parent.children;
  },

  get _selfIndex() {
    var siblings = this._siblings;
    return siblings.indexOf(this);
  },

  get parent() {
    return this._parent;
  },

  get children() {
    return this._children;
  },

  get root() {
    if (this._parent) {
      return this._parent.root;
    } else {
      return this;
    }
  },

  appendChild: function(node) {
    node.detach();
    this._children.push(node);   
    node._parent = this;
    return node;
  }, 

  appendChildAfter: function(node, sibling) {
    node.detach();
    var index = sibling._selfIndex;
    this._children.splice(index + 1, 0, node);
    node._parent = this;
    return node;
  },

  nextNode: function() {
    // FIXME ugly like hell
    var justPassedBy = false;
    return this.root.find(n => {
      if (justPassedBy) {
        return true;
      }
      if (n === this) {
        justPassedBy = true;
      }
    });
  },
  
  prevNode: function() {
    // FIXME ugly like hell
    var justPassedBy = false;
    return this.root.findReverse(n => {
      if (justPassedBy) {
        return true;
      }
      if (n === this) {
        justPassedBy = true;
      }
    });
  },

  isRoot: function() {
    return !this._parent;
  },

  getDepth: function() {
    if (this.isRoot()) {
      return 0;
    }
    return this._parent.getDepth() + 1;
  },

  walk: function(callback) {
    this.find(n => {
      callback(n);
      return false;
    });
  },

  find: function(findMethod) {
    if (findMethod(this)) {
      return this;
    }
    for (var child of this._children) {
      var ret = child.find(findMethod);
      if (ret) {
        return ret;
      }
    }
    return null;
  },

  findReverse: function(findMethod) {
    var count = this._children.length;
    for (var i = count - 1; i >= 0; i--) {
      var ret = this._children[i].findReverse(findMethod);
      if (ret) {
        return ret;
      }
    }
    if (findMethod(this)) {
      return this;
    }
    return null;
  },

  lastNode: function() {
    if (this._children.length == 0) {
      return this;
    }
    return this._children[this._children.length - 1].lastNode();
  },

  detach: function() {
    if (this._parent) {
      this._siblings.splice(this._selfIndex, 1);
      this._parent = null;
    }
    return this;
  },

}

function safeIframeCall(iframe, method, ...args) {
  if (iframe) {
    if (iframe[method]) {
      return iframe[method](...args);
    } else {
      console.warn(`WARNING: Browser API ${method} method not available`);
    }
  }
}
