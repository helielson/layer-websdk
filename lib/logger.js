'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class layer.Logger
 * @private
 *
 */
var _require$LOG = require('./const').LOG,
    DEBUG = _require$LOG.DEBUG,
    INFO = _require$LOG.INFO,
    WARN = _require$LOG.WARN,
    ERROR = _require$LOG.ERROR,
    NONE = _require$LOG.NONE;

var _require = require('./client-utils'),
    isEmpty = _require.isEmpty;

// Pretty arbitrary test that IE/edge fails and others don't.  Yes I could do a more direct
// test for IE/edge but its hoped that MS will fix this around the time they cleanup their internal console object.


var supportsConsoleFormatting = Boolean(console.assert && console.assert.toString().match(/assert/));
var LayerCss = 'color: #888; font-weight: bold;';
var Black = 'color: black';
/* istanbulify ignore next */

var Logger = function () {
  function Logger() {
    _classCallCheck(this, Logger);
  }

  _createClass(Logger, [{
    key: 'log',
    value: function log(msg, obj, type, color) {
      /* istanbul ignore else */
      if ((typeof msg === 'undefined' ? 'undefined' : _typeof(msg)) === 'object') {
        obj = msg;
        msg = '';
      }
      var timestamp = new Date().toLocaleTimeString();
      var op;
      switch (type) {
        case DEBUG:
          op = 'debug';
          break;
        case INFO:
          op = 'info';
          break;
        case WARN:
          op = 'warn';
          break;
        case ERROR:
          op = 'error';
          break;
        default:
          op = 'log';
      }
      if (obj) {
        if (supportsConsoleFormatting) {
          console[op]('%cLayer%c ' + op.toUpperCase() + '%c [' + timestamp + ']: ' + msg, LayerCss, 'color: ' + color, Black, obj);
        } else {
          console[op]('Layer ' + op.toUpperCase() + ' [' + timestamp + ']: ' + msg, obj);
        }
      } else {
        if (supportsConsoleFormatting) {
          console[op]('%cLayer%c ' + op.toUpperCase() + '%c [' + timestamp + ']: ' + msg, LayerCss, 'color: ' + color, Black);
        } else {
          console[op]('Layer ' + op.toUpperCase() + ' [' + timestamp + ']: ' + msg);
        }
      }
    }
  }, {
    key: 'debug',
    value: function debug(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= DEBUG) this.log(msg, obj, DEBUG, '#888');
    }
  }, {
    key: 'info',
    value: function info(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= INFO) this.log(msg, obj, INFO, 'black');
    }
  }, {
    key: 'warn',
    value: function warn(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= WARN) this.log(msg, obj, WARN, 'orange');
    }
  }, {
    key: 'error',
    value: function error(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= ERROR) this.log(msg, obj, ERROR, 'red');
    }
  }]);

  return Logger;
}();

/* istanbul ignore next */


Logger.prototype.level = typeof jasmine === 'undefined' ? ERROR : NONE;

var logger = new Logger();

module.exports = logger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sb2dnZXIuanMiXSwibmFtZXMiOlsicmVxdWlyZSIsIkxPRyIsIkRFQlVHIiwiSU5GTyIsIldBUk4iLCJFUlJPUiIsIk5PTkUiLCJpc0VtcHR5Iiwic3VwcG9ydHNDb25zb2xlRm9ybWF0dGluZyIsIkJvb2xlYW4iLCJjb25zb2xlIiwiYXNzZXJ0IiwidG9TdHJpbmciLCJtYXRjaCIsIkxheWVyQ3NzIiwiQmxhY2siLCJMb2dnZXIiLCJtc2ciLCJvYmoiLCJ0eXBlIiwiY29sb3IiLCJ0aW1lc3RhbXAiLCJEYXRlIiwidG9Mb2NhbGVUaW1lU3RyaW5nIiwib3AiLCJ0b1VwcGVyQ2FzZSIsImxldmVsIiwibG9nIiwicHJvdG90eXBlIiwiamFzbWluZSIsImxvZ2dlciIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7O21CQUsyQ0EsUUFBUSxTQUFSLEVBQW1CQyxHO0lBQXREQyxLLGdCQUFBQSxLO0lBQU9DLEksZ0JBQUFBLEk7SUFBTUMsSSxnQkFBQUEsSTtJQUFNQyxLLGdCQUFBQSxLO0lBQU9DLEksZ0JBQUFBLEk7O2VBQ2ROLFFBQVEsZ0JBQVIsQztJQUFaTyxPLFlBQUFBLE87O0FBRVI7QUFDQTs7O0FBQ0EsSUFBTUMsNEJBQTRCQyxRQUFRQyxRQUFRQyxNQUFSLElBQWtCRCxRQUFRQyxNQUFSLENBQWVDLFFBQWYsR0FBMEJDLEtBQTFCLENBQWdDLFFBQWhDLENBQTFCLENBQWxDO0FBQ0EsSUFBTUMsV0FBVyxpQ0FBakI7QUFDQSxJQUFNQyxRQUFRLGNBQWQ7QUFDQTs7SUFDTUMsTTs7Ozs7Ozt3QkFDQUMsRyxFQUFLQyxHLEVBQUtDLEksRUFBTUMsSyxFQUFPO0FBQ3pCO0FBQ0EsVUFBSSxRQUFPSCxHQUFQLHlDQUFPQSxHQUFQLE9BQWUsUUFBbkIsRUFBNkI7QUFDM0JDLGNBQU1ELEdBQU47QUFDQUEsY0FBTSxFQUFOO0FBQ0Q7QUFDRCxVQUFNSSxZQUFZLElBQUlDLElBQUosR0FBV0Msa0JBQVgsRUFBbEI7QUFDQSxVQUFJQyxFQUFKO0FBQ0EsY0FBT0wsSUFBUDtBQUNFLGFBQUtqQixLQUFMO0FBQ0VzQixlQUFLLE9BQUw7QUFDQTtBQUNGLGFBQUtyQixJQUFMO0FBQ0VxQixlQUFLLE1BQUw7QUFDQTtBQUNGLGFBQUtwQixJQUFMO0FBQ0VvQixlQUFLLE1BQUw7QUFDQTtBQUNGLGFBQUtuQixLQUFMO0FBQ0VtQixlQUFLLE9BQUw7QUFDQTtBQUNGO0FBQ0VBLGVBQUssS0FBTDtBQWRKO0FBZ0JBLFVBQUlOLEdBQUosRUFBUztBQUNQLFlBQUlWLHlCQUFKLEVBQStCO0FBQzdCRSxrQkFBUWMsRUFBUixpQkFBeUJBLEdBQUdDLFdBQUgsRUFBekIsWUFBZ0RKLFNBQWhELFdBQStESixHQUEvRCxFQUFzRUgsUUFBdEUsY0FBMEZNLEtBQTFGLEVBQW1HTCxLQUFuRyxFQUEwR0csR0FBMUc7QUFDRCxTQUZELE1BRU87QUFDTFIsa0JBQVFjLEVBQVIsYUFBcUJBLEdBQUdDLFdBQUgsRUFBckIsVUFBMENKLFNBQTFDLFdBQXlESixHQUF6RCxFQUFnRUMsR0FBaEU7QUFDRDtBQUNGLE9BTkQsTUFNTztBQUNMLFlBQUlWLHlCQUFKLEVBQStCO0FBQzdCRSxrQkFBUWMsRUFBUixpQkFBeUJBLEdBQUdDLFdBQUgsRUFBekIsWUFBZ0RKLFNBQWhELFdBQStESixHQUEvRCxFQUFzRUgsUUFBdEUsY0FBMEZNLEtBQTFGLEVBQW1HTCxLQUFuRztBQUNELFNBRkQsTUFFTztBQUNMTCxrQkFBUWMsRUFBUixhQUFxQkEsR0FBR0MsV0FBSCxFQUFyQixVQUEwQ0osU0FBMUMsV0FBeURKLEdBQXpEO0FBQ0Q7QUFDRjtBQUNGOzs7MEJBR0tBLEcsRUFBS0MsRyxFQUFLO0FBQ2Q7QUFDQSxVQUFJLEtBQUtRLEtBQUwsSUFBY3hCLEtBQWxCLEVBQXlCLEtBQUt5QixHQUFMLENBQVNWLEdBQVQsRUFBY0MsR0FBZCxFQUFtQmhCLEtBQW5CLEVBQTBCLE1BQTFCO0FBQzFCOzs7eUJBRUllLEcsRUFBS0MsRyxFQUFLO0FBQ2I7QUFDQSxVQUFJLEtBQUtRLEtBQUwsSUFBY3ZCLElBQWxCLEVBQXdCLEtBQUt3QixHQUFMLENBQVNWLEdBQVQsRUFBY0MsR0FBZCxFQUFtQmYsSUFBbkIsRUFBeUIsT0FBekI7QUFDekI7Ozt5QkFFSWMsRyxFQUFLQyxHLEVBQUs7QUFDYjtBQUNBLFVBQUksS0FBS1EsS0FBTCxJQUFjdEIsSUFBbEIsRUFBd0IsS0FBS3VCLEdBQUwsQ0FBU1YsR0FBVCxFQUFjQyxHQUFkLEVBQW1CZCxJQUFuQixFQUF5QixRQUF6QjtBQUN6Qjs7OzBCQUVLYSxHLEVBQUtDLEcsRUFBSztBQUNkO0FBQ0EsVUFBSSxLQUFLUSxLQUFMLElBQWNyQixLQUFsQixFQUF5QixLQUFLc0IsR0FBTCxDQUFTVixHQUFULEVBQWNDLEdBQWQsRUFBbUJiLEtBQW5CLEVBQTBCLEtBQTFCO0FBQzFCOzs7Ozs7QUFHSDs7O0FBQ0FXLE9BQU9ZLFNBQVAsQ0FBaUJGLEtBQWpCLEdBQXlCLE9BQU9HLE9BQVAsS0FBbUIsV0FBbkIsR0FBaUN4QixLQUFqQyxHQUF5Q0MsSUFBbEU7O0FBRUEsSUFBTXdCLFNBQVMsSUFBSWQsTUFBSixFQUFmOztBQUVBZSxPQUFPQyxPQUFQLEdBQWlCRixNQUFqQiIsImZpbGUiOiJsb2dnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyBsYXllci5Mb2dnZXJcbiAqIEBwcml2YXRlXG4gKlxuICovXG5jb25zdCB7IERFQlVHLCBJTkZPLCBXQVJOLCBFUlJPUiwgTk9ORSB9ID0gcmVxdWlyZSgnLi9jb25zdCcpLkxPRztcbmNvbnN0IHsgaXNFbXB0eSB9ID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcblxuLy8gUHJldHR5IGFyYml0cmFyeSB0ZXN0IHRoYXQgSUUvZWRnZSBmYWlscyBhbmQgb3RoZXJzIGRvbid0LiAgWWVzIEkgY291bGQgZG8gYSBtb3JlIGRpcmVjdFxuLy8gdGVzdCBmb3IgSUUvZWRnZSBidXQgaXRzIGhvcGVkIHRoYXQgTVMgd2lsbCBmaXggdGhpcyBhcm91bmQgdGhlIHRpbWUgdGhleSBjbGVhbnVwIHRoZWlyIGludGVybmFsIGNvbnNvbGUgb2JqZWN0LlxuY29uc3Qgc3VwcG9ydHNDb25zb2xlRm9ybWF0dGluZyA9IEJvb2xlYW4oY29uc29sZS5hc3NlcnQgJiYgY29uc29sZS5hc3NlcnQudG9TdHJpbmcoKS5tYXRjaCgvYXNzZXJ0LykpO1xuY29uc3QgTGF5ZXJDc3MgPSAnY29sb3I6ICM4ODg7IGZvbnQtd2VpZ2h0OiBib2xkOyc7XG5jb25zdCBCbGFjayA9ICdjb2xvcjogYmxhY2snO1xuLyogaXN0YW5idWxpZnkgaWdub3JlIG5leHQgKi9cbmNsYXNzIExvZ2dlciB7XG4gIGxvZyhtc2csIG9iaiwgdHlwZSwgY29sb3IpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIGlmICh0eXBlb2YgbXNnID09PSAnb2JqZWN0Jykge1xuICAgICAgb2JqID0gbXNnO1xuICAgICAgbXNnID0gJyc7XG4gICAgfVxuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9Mb2NhbGVUaW1lU3RyaW5nKCk7XG4gICAgdmFyIG9wO1xuICAgIHN3aXRjaCh0eXBlKSB7XG4gICAgICBjYXNlIERFQlVHOlxuICAgICAgICBvcCA9ICdkZWJ1Zyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBJTkZPOlxuICAgICAgICBvcCA9ICdpbmZvJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFdBUk46XG4gICAgICAgIG9wID0gJ3dhcm4nO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRVJST1I6XG4gICAgICAgIG9wID0gJ2Vycm9yJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBvcCA9ICdsb2cnO1xuICAgIH1cbiAgICBpZiAob2JqKSB7XG4gICAgICBpZiAoc3VwcG9ydHNDb25zb2xlRm9ybWF0dGluZykge1xuICAgICAgICBjb25zb2xlW29wXShgJWNMYXllciVjICR7b3AudG9VcHBlckNhc2UoKX0lYyBbJHt0aW1lc3RhbXB9XTogJHttc2d9YCwgTGF5ZXJDc3MsIGBjb2xvcjogJHtjb2xvcn1gLCBCbGFjaywgb2JqKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGVbb3BdKGBMYXllciAke29wLnRvVXBwZXJDYXNlKCl9IFske3RpbWVzdGFtcH1dOiAke21zZ31gLCBvYmopO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoc3VwcG9ydHNDb25zb2xlRm9ybWF0dGluZykge1xuICAgICAgICBjb25zb2xlW29wXShgJWNMYXllciVjICR7b3AudG9VcHBlckNhc2UoKX0lYyBbJHt0aW1lc3RhbXB9XTogJHttc2d9YCwgTGF5ZXJDc3MsIGBjb2xvcjogJHtjb2xvcn1gLCBCbGFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlW29wXShgTGF5ZXIgJHtvcC50b1VwcGVyQ2FzZSgpfSBbJHt0aW1lc3RhbXB9XTogJHttc2d9YCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBkZWJ1Zyhtc2csIG9iaikge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgaWYgKHRoaXMubGV2ZWwgPj0gREVCVUcpIHRoaXMubG9nKG1zZywgb2JqLCBERUJVRywgJyM4ODgnKTtcbiAgfVxuXG4gIGluZm8obXNnLCBvYmopIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0aGlzLmxldmVsID49IElORk8pIHRoaXMubG9nKG1zZywgb2JqLCBJTkZPLCAnYmxhY2snKTtcbiAgfVxuXG4gIHdhcm4obXNnLCBvYmopIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0aGlzLmxldmVsID49IFdBUk4pIHRoaXMubG9nKG1zZywgb2JqLCBXQVJOLCAnb3JhbmdlJyk7XG4gIH1cblxuICBlcnJvcihtc2csIG9iaikge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgaWYgKHRoaXMubGV2ZWwgPj0gRVJST1IpIHRoaXMubG9nKG1zZywgb2JqLCBFUlJPUiwgJ3JlZCcpO1xuICB9XG59XG5cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5Mb2dnZXIucHJvdG90eXBlLmxldmVsID0gdHlwZW9mIGphc21pbmUgPT09ICd1bmRlZmluZWQnID8gRVJST1IgOiBOT05FO1xuXG5jb25zdCBsb2dnZXIgPSBuZXcgTG9nZ2VyKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbG9nZ2VyO1xuIl19
