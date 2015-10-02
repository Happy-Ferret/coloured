'use strict';

const platform = navigator.platform.startsWith('Win') ? 'win' :
                 navigator.platform.startsWith('Mac') ? 'mac' :
                 navigator.platform.startsWith('Linux') ? 'x11' :
                 navigator.platform.startsWith('FreeBSD') ? 'x11' :
                 navigator.platform;

module.exports = platform;
