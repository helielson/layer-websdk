'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('./client-utils');
var LayerEvent = require('./layer-event');
var LayerError = require('./layer-error');
var Events = require('backbone-events-standalone/backbone-events-standalone');
var Logger = require('./logger');

/*
 * Provides a system bus that can be accessed by all components of the system.
 * Currently used to listen to messages sent via postMessage, but envisioned to
 * do far more.
 */
function EventClass() {}
EventClass.prototype = Events;

var SystemBus = new EventClass();
if (typeof postMessage === 'function') {
  addEventListener('message', function (event) {
    if (event.data.type === 'layer-delayed-event') {
      SystemBus.trigger(event.data.internalId + '-delayed-event');
    }
  });
}

// Used to generate a unique internalId for every Root instance
var uniqueIds = {};

// Regex for splitting an event string such as obj.on('evtName1 evtName2 evtName3')
var eventSplitter = /\s+/;

/**
 * The root class of all layer objects. Provides the following utilities
 *
 * 1. Mixes in the Backbone event model
 *
 *        var person = new Person();
 *        person.on('destroy', function() {
 *            console.log('I have been destroyed!');
 *        });
 *
 *        // Fire the console log handler:
 *        person.trigger('destroy');
 *
 *        // Unsubscribe
 *        person.off('destroy');
 *
 * 2. Adds a subscriptions object so that any event handlers on an object can be quickly found and removed
 *
 *        var person1 = new Person();
 *        var person2 = new Person();
 *        person2.on('destroy', function() {
 *            console.log('I have been destroyed!');
 *        }, person1);
 *
 *        // Pointers to person1 held onto by person2 are removed
 *        person1.destroy();
 *
 * 3. Adds support for event listeners in the constructor
 *    Any event handler can be passed into the constructor
 *    just as though it were a property.
 *
 *        var person = new Person({
 *            age: 150,
 *            destroy: function() {
 *                console.log('I have been destroyed!');
 *            }
 *        });
 *
 * 4. A _disableEvents property
 *
 *        myMethod() {
 *          if (this.isInitializing) {
 *              this._disableEvents = true;
 *
 *              // Event only received if _disableEvents = false
 *              this.trigger('destroy');
 *              this._disableEvents = false;
 *          }
 *        }
 *
 * 5. A _supportedEvents static property for each class
 *
 *     This property defines which events can be triggered.
 *
 *     * Any attempt to trigger
 *       an event not in _supportedEvents will log an error.
 *     * Any attempt to register a listener for an event not in _supportedEvents will
 *     *throw* an error.
 *
 *     This allows us to insure developers only subscribe to valid events.
 *
 *     This allows us to control what events can be fired and which ones blocked.
 *
 * 6. Adds an internalId property
 *
 *        var person = new Person();
 *        console.log(person.internalId); // -> 'Person1'
 *
 * 7. Adds a toObject method to create a simplified Plain Old Javacript Object from your object
 *
 *        var person = new Person();
 *        var simplePerson = person.toObject();
 *
 * 8. Provides __adjustProperty method support
 *
 *     For any property of a class, an `__adjustProperty` method can be defined.  If its defined,
 *     it will be called prior to setting that property, allowing:
 *
 *     A. Modification of the value that is actually set
 *     B. Validation of the value; throwing errors if invalid.
 *
 * 9. Provides __udpateProperty method support
 *
 *     After setting any property for which there is an `__updateProperty` method defined,
 *     the method will be called, allowing the new property to be applied.
 *
 *     Typically used for
 *
 *     A. Triggering events
 *     B. Firing XHR requests
 *     C. Updating the UI to match the new property value
 *
 *
 * @class layer.Root
 * @abstract
 * @author Michael Kantor
 */

var Root = function (_EventClass) {
  _inherits(Root, _EventClass);

  /**
   * Superclass constructor handles copying in properties and registering event handlers.
   *
   * @method constructor
   * @param  {Object} options - a hash of properties and event handlers
   * @return {layer.Root}
   */
  function Root() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Root);

    var _this = _possibleConstructorReturn(this, (Root.__proto__ || Object.getPrototypeOf(Root)).call(this));

    _this._layerEventSubscriptions = [];
    _this._delayedTriggers = [];
    _this._lastDelayedTrigger = Date.now();
    _this._events = {};

    // Generate an internalId
    var name = _this.constructor.name;
    if (!uniqueIds[name]) uniqueIds[name] = 0;
    _this.internalId = name + uniqueIds[name]++;

    // Every component listens to the SystemBus for postMessage (triggerAsync) events
    SystemBus.on(_this.internalId + '-delayed-event', _this._processDelayedTriggers, _this);

    // Generate a temporary id if there isn't an id
    if (!_this.id && !options.id && _this.constructor.prefixUUID) {
      _this.id = _this.constructor.prefixUUID + Utils.generateUUID();
    }

    // Copy in all properties; setup all event handlers
    var key = void 0;
    for (key in options) {
      if (_this.constructor._supportedEvents.indexOf(key) !== -1) {
        _this.on(key, options[key]);
      } else if (key in _this && typeof _this[key] !== 'function') {
        _this[key] = options[key];
      }
    }
    _this.isInitializing = false;
    return _this;
  }

  /**
   * Destroys the object.
   *
   * Cleans up all events / subscriptions
   * and marks the object as isDestroyed.
   *
   * @method destroy
   */


  _createClass(Root, [{
    key: 'destroy',
    value: function destroy() {
      var _this2 = this;

      if (this.isDestroyed) throw new Error(LayerError.dictionary.alreadyDestroyed);

      // If anyone is listening, notify them
      this.trigger('destroy');

      // Cleanup pointers to SystemBus. Failure to call destroy
      // will have very serious consequences...
      SystemBus.off(this.internalId + '-delayed-event', null, this);

      // Remove all events, and all pointers passed to this object by other objects
      this.off();

      // Find all of the objects that this object has passed itself to in the form
      // of event handlers and remove all references to itself.
      this._layerEventSubscriptions.forEach(function (item) {
        return item.off(null, null, _this2);
      });

      this._layerEventSubscriptions = null;
      this._delayedTriggers = null;
      this.isDestroyed = true;
    }
  }, {
    key: 'toObject',


    /**
     * Convert class instance to Plain Javascript Object.
     *
     * Strips out all private members, and insures no datastructure loops.
     * Recursively converting all subobjects using calls to toObject.
     *
     *      console.dir(myobj.toObject());
     *
     * Note: While it would be tempting to have noChildren default to true,
     * this would result in Message.toObject() not outputing its MessageParts.
     *
     * Private data (_ prefixed properties) will not be output.
     *
     * @method toObject
     * @param  {boolean} [noChildren=false] Don't output sub-components
     * @return {Object}
     */
    value: function toObject() {
      var _this3 = this;

      var noChildren = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      this.__inToObject = true;
      var obj = {};

      // Iterate over all formally defined properties
      try {
        var keys = [];
        for (var _key in this.constructor.prototype) {
          if (!(_key in Root.prototype)) keys.push(_key);
        }keys.forEach(function (key) {
          var v = _this3[key];

          // Ignore private/protected properties and functions
          if (key.indexOf('_') === 0) return;
          if (typeof v === 'function') return;

          // Generate arrays...
          if (Array.isArray(v)) {
            obj[key] = [];
            v.forEach(function (item) {
              if (item instanceof Root) {
                if (noChildren) {
                  delete obj[key];
                } else if (!item.__inToObject) {
                  obj[key].push(item.toObject());
                }
              } else {
                obj[key].push(item);
              }
            });
          }

          // Generate subcomponents
          else if (v instanceof Root) {
              if (!v.__inToObject && !noChildren) {
                obj[key] = v.toObject();
              }
            }

            // Generate dates (creates a copy to separate it from the source object)
            else if (v instanceof Date) {
                obj[key] = new Date(v);
              }

              // Generate simple properties
              else {
                  obj[key] = v;
                }
        });
      } catch (e) {
        // no-op
      }
      this.__inToObject = false;
      return obj;
    }

    /**
     * Log a warning for attempts to subscribe to unsupported events.
     *
     * @method _warnForEvent
     * @private
     */

  }, {
    key: '_warnForEvent',
    value: function _warnForEvent(eventName) {
      if (!Utils.includes(this.constructor._supportedEvents, eventName)) {
        throw new Error('Event ' + eventName + ' not defined for ' + this.toString());
      }
    }

    /**
     * Prepare for processing an event subscription call.
     *
     * If context is a Root class, add this object to the context's subscriptions.
     *
     * @method _prepareOn
     * @private
     */

  }, {
    key: '_prepareOn',
    value: function _prepareOn(name, handler, context) {
      var _this4 = this;

      if (context) {
        if (context instanceof Root) {
          if (context.isDestroyed) {
            throw new Error(LayerError.dictionary.isDestroyed);
          }
        }
        if (context._layerEventSubscriptions) {
          context._layerEventSubscriptions.push(this);
        }
      }
      if (typeof name === 'string' && name !== 'all') {
        if (eventSplitter.test(name)) {
          var names = name.split(eventSplitter);
          names.forEach(function (n) {
            return _this4._warnForEvent(n);
          });
        } else {
          this._warnForEvent(name);
        }
      } else if (name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object') {
        Object.keys(name).forEach(function (keyName) {
          return _this4._warnForEvent(keyName);
        });
      }
    }

    /**
     * Subscribe to events.
     *
     * Note that the context parameter serves double importance here:
     *
     * 1. It determines the context in which to execute the event handler
     * 2. Create a backlink so that if either subscriber or subscribee is destroyed,
     *    all pointers between them can be found and removed.
     *
     * ```
     * obj.on('someEventName someOtherEventName', mycallback, mycontext);
     * ```
     *
     * ```
     * obj.on({
     *    eventName1: callback1,
     *    eventName2: callback2
     * }, mycontext);
     * ```
     *
     * @method on
     * @param  {String} name - Name of the event
     * @param  {Function} handler - Event handler
     * @param  {layer.LayerEvent} handler.event - Event object delivered to the handler
     * @param  {Object} context - This pointer AND link to help with cleanup
     * @return {layer.Root} this
     */

  }, {
    key: 'on',
    value: function on(name, handler, context) {
      this._prepareOn(name, handler, context);
      Events.on.apply(this, [name, handler, context]);
      return this;
    }

    /**
     * Subscribe to the first occurance of the specified event.
     *
     * @method once
     * @return {layer.Root} this
     */

  }, {
    key: 'once',
    value: function once(name, handler, context) {
      this._prepareOn(name, handler, context);
      Events.once.apply(this, [name, handler, context]);
      return this;
    }

    /**
     * Unsubscribe from events.
     *
     * ```
     * // Removes all event handlers for this event:
     * obj.off('someEventName');
     *
     * // Removes all event handlers using this function pointer as callback
     * obj.off(null, f, null);
     *
     * // Removes all event handlers that `this` has subscribed to; requires
     * // obj.on to be called with `this` as its `context` parameter.
     * obj.off(null, null, this);
     * ```
     *
     * @method off
     * @param  {String} name - Name of the event; null for all event names
     * @param  {Function} handler - Event handler; null for all functions
     * @param  {Object} context - The context from the `on()` call to search for; null for all contexts
     * @return {layer.Root} this
     */

    /**
     * Trigger an event for any event listeners.
     *
     * Events triggered this way will be blocked if _disableEvents = true
     *
     * @method trigger
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     * @return {layer.Root} this
     */

  }, {
    key: 'trigger',
    value: function trigger() {
      if (this._disableEvents) return this;
      return this._trigger.apply(this, arguments);
    }

    /**
     * Triggers an event.
     *
     * @method trigger
     * @private
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     */

  }, {
    key: '_trigger',
    value: function _trigger() {
      if (!Utils.includes(this.constructor._supportedEvents, arguments.length <= 0 ? undefined : arguments[0])) {
        if (!Utils.includes(this.constructor._ignoredEvents, arguments.length <= 0 ? undefined : arguments[0])) {
          Logger.error(this.toString() + ' ignored ' + (arguments.length <= 0 ? undefined : arguments[0]));
        }
        return;
      }

      var computedArgs = this._getTriggerArgs.apply(this, arguments);

      Events.trigger.apply(this, computedArgs);

      var parentProp = this.constructor.bubbleEventParent;
      if (parentProp) {
        var _parentValue;

        var parentValue = this[parentProp];
        parentValue = typeof parentValue === 'function' ? parentValue.apply(this) : parentValue;
        if (parentValue) (_parentValue = parentValue).trigger.apply(_parentValue, _toConsumableArray(computedArgs));
      }
    }

    /**
     * Generates a layer.LayerEvent from a trigger call's arguments.
     *
     * * If parameter is already a layer.LayerEvent, we're done.
     * * If parameter is an object, a `target` property is added to that object and its delivered to all subscribers
     * * If the parameter is non-object value, it is added to an object with a `target` property, and the value is put in
     *   the `data` property.
     *
     * @method _getTriggerArgs
     * @private
     * @return {Mixed[]} - First element of array is eventName, second element is layer.LayerEvent.
     */

  }, {
    key: '_getTriggerArgs',
    value: function _getTriggerArgs() {
      var _this5 = this;

      for (var _len = arguments.length, args = Array(_len), _key2 = 0; _key2 < _len; _key2++) {
        args[_key2] = arguments[_key2];
      }

      var computedArgs = Array.prototype.slice.call(args);

      if (args[1]) {
        (function () {
          var newArg = { target: _this5 };

          if (computedArgs[1] instanceof LayerEvent) {
            // A LayerEvent will be an argument when bubbling events up; these args can be used as-is
          } else {
            if (_typeof(computedArgs[1]) === 'object') {
              Object.keys(computedArgs[1]).forEach(function (name) {
                newArg[name] = computedArgs[1][name];
              });
            } else {
              newArg.data = computedArgs[1];
            }
            computedArgs[1] = new LayerEvent(newArg, computedArgs[0]);
          }
        })();
      } else {
        computedArgs[1] = new LayerEvent({ target: this }, computedArgs[0]);
      }

      return computedArgs;
    }

    /**
     * Same as _trigger() method, but delays briefly before firing.
     *
     * When would you want to delay an event?
     *
     * 1. There is an event rollup that may be needed for the event;
     *    this requires the framework to be able to see ALL events that have been
     *    generated, roll them up, and THEN fire them.
     * 2. The event is intended for UI rendering... which should not hold up the rest of
     *    this framework's execution.
     *
     * When NOT to delay an event?
     *
     * 1. Lifecycle events frequently require response at the time the event has fired
     *
     * @method _triggerAsync
     * @private
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     * @return {layer.Root} this
     */

  }, {
    key: '_triggerAsync',
    value: function _triggerAsync() {
      var _this6 = this;

      var computedArgs = this._getTriggerArgs.apply(this, arguments);
      this._delayedTriggers.push(computedArgs);

      // NOTE: It is unclear at this time how it happens, but on very rare occasions, we see processDelayedTriggers
      // fail to get called when length = 1, and after that length just continuously grows.  So we add
      // the _lastDelayedTrigger test to insure that it will still run.
      var shouldScheduleTrigger = this._delayedTriggers.length === 1 || this._delayedTriggers.length && this._lastDelayedTrigger + 500 < Date.now();
      if (shouldScheduleTrigger) {
        this._lastDelayedTrigger = Date.now();
        if (typeof postMessage === 'function' && typeof jasmine === 'undefined') {
          var messageData = {
            type: 'layer-delayed-event',
            internalId: this.internalId
          };
          if (typeof document !== 'undefined') {
            window.postMessage(messageData, '*');
          } else {
            // React Native reportedly lacks a document, and throws errors on the second parameter
            window.postMessage(messageData);
          }
        } else {
          setTimeout(function () {
            return _this6._processDelayedTriggers();
          }, 0);
        }
      }
    }

    /**
     * Combines a set of events into a single event.
     *
     * Given an event structure of
     * ```
     *      {
     *          customName: [value1]
     *      }
     *      {
     *          customName: [value2]
     *      }
     *      {
     *          customName: [value3]
     *      }
     * ```
     *
     * Merge them into
     *
     * ```
     *      {
     *          customName: [value1, value2, value3]
     *      }
     * ```
     *
     * @method _foldEvents
     * @private
     * @param  {layer.LayerEvent[]} events
     * @param  {string} name      Name of the property (i.e. 'customName')
     * @param  {layer.Root}    newTarget Value of the target for the folded resulting event
     */

  }, {
    key: '_foldEvents',
    value: function _foldEvents(events, name, newTarget) {
      var _this7 = this;

      var firstEvt = events.length ? events[0][1] : null;
      var firstEvtProp = firstEvt ? firstEvt[name] : null;
      events.forEach(function (evt, i) {
        if (i > 0) {
          firstEvtProp.push(evt[1][name][0]);
          _this7._delayedTriggers.splice(_this7._delayedTriggers.indexOf(evt), 1);
        }
      });
      if (events.length && newTarget) events[0][1].target = newTarget;
    }

    /**
     * Fold a set of Change events into a single Change event.
     *
     * Given a set change events on this component,
     * fold all change events into a single event via
     * the layer.LayerEvent's changes array.
     *
     * @method _foldChangeEvents
     * @private
     */

  }, {
    key: '_foldChangeEvents',
    value: function _foldChangeEvents() {
      var _this8 = this;

      var events = this._delayedTriggers.filter(function (evt) {
        return evt[1].isChange;
      });
      events.forEach(function (evt, i) {
        if (i > 0) {
          events[0][1]._mergeChanges(evt[1]);
          _this8._delayedTriggers.splice(_this8._delayedTriggers.indexOf(evt), 1);
        }
      });
    }

    /**
     * Execute all delayed events for this compoennt.
     *
     * @method _processDelayedTriggers
     * @private
     */

  }, {
    key: '_processDelayedTriggers',
    value: function _processDelayedTriggers() {
      if (this.isDestroyed) return;
      this._foldChangeEvents();

      this._delayedTriggers.forEach(function (evt) {
        this.trigger.apply(this, _toConsumableArray(evt));
      }, this);
      this._delayedTriggers = [];
    }

    /**
     * Returns a string representation of the class that is nicer than `[Object]`.
     *
     * @method toString
     * @return {String}
     */

  }, {
    key: 'toString',
    value: function toString() {
      return this.internalId;
    }
  }], [{
    key: 'isValidId',
    value: function isValidId(id) {
      return id.indexOf(this.prefixUUID) === 0;
    }
  }]);

  return Root;
}(EventClass);

function defineProperty(newClass, propertyName) {
  var pKey = '__' + propertyName;
  var camel = propertyName.substring(0, 1).toUpperCase() + propertyName.substring(1);

  var hasDefinitions = newClass.prototype['__adjust' + camel] || newClass.prototype['__update' + camel] || newClass.prototype['__get' + camel];
  if (hasDefinitions) {
    // set default value
    newClass.prototype[pKey] = newClass.prototype[propertyName];

    Object.defineProperty(newClass.prototype, propertyName, {
      enumerable: true,
      get: function get() {
        return this['__get' + camel] ? this['__get' + camel](pKey) : this[pKey];
      },
      set: function set(inValue) {
        if (this.isDestroyed) return;
        var initial = this[pKey];
        if (inValue !== initial) {
          if (this['__adjust' + camel]) {
            var result = this['__adjust' + camel](inValue);
            if (result !== undefined) inValue = result;
          }
          this[pKey] = inValue;
        }
        if (inValue !== initial) {
          if (!this.isInitializing && this['__update' + camel]) {
            this['__update' + camel](inValue, initial);
          }
        }
      }
    });
  }
}

function initClass(newClass, className) {
  // Make sure our new class has a name property
  if (!newClass.name) newClass.name = className;

  // Make sure our new class has a _supportedEvents, _ignoredEvents, _inObjectIgnore and EVENTS properties
  if (!newClass._supportedEvents) newClass._supportedEvents = Root._supportedEvents;
  if (!newClass._ignoredEvents) newClass._ignoredEvents = Root._ignoredEvents;

  // Generate a list of properties for this class; we don't include any
  // properties from layer.Root
  var keys = Object.keys(newClass.prototype).filter(function (key) {
    return newClass.prototype.hasOwnProperty(key) && !Root.prototype.hasOwnProperty(key) && typeof newClass.prototype[key] !== 'function';
  });

  // Define getters/setters for any property that has __adjust or __update methods defined
  keys.forEach(function (name) {
    return defineProperty(newClass, name);
  });
}

/**
 * Set to true once destroy() has been called.
 *
 * A destroyed object will likely cause errors in any attempt
 * to call methods on it, and will no longer trigger events.
 *
 * @type {boolean}
 * @readonly
 */
Root.prototype.isDestroyed = false;

/**
 * Every instance has its own internal ID.
 *
 * This ID is distinct from any IDs assigned by the server.
 * The internal ID is gaurenteed not to change within the lifetime of the Object/session;
 * it is possible, on creating a new object, for its `id` property to change.
 *
 * @type {string}
 * @readonly
 */
Root.prototype.internalId = '';

/**
 * True while we are in the constructor.
 *
 * @type {boolean}
 * @readonly
 */
Root.prototype.isInitializing = true;

/**
 * Objects that this object is listening for events from.
 *
 * @type {layer.Root[]}
 * @private
 */
Root.prototype._layerEventSubscriptions = null;

/**
 * Disable all events triggered on this object.
 * @type {boolean}
 * @private
 */
Root.prototype._disableEvents = false;

Root._supportedEvents = ['destroy', 'all'];
Root._ignoredEvents = [];
module.exports = Root;
module.exports.initClass = initClass;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yb290LmpzIl0sIm5hbWVzIjpbIlV0aWxzIiwicmVxdWlyZSIsIkxheWVyRXZlbnQiLCJMYXllckVycm9yIiwiRXZlbnRzIiwiTG9nZ2VyIiwiRXZlbnRDbGFzcyIsInByb3RvdHlwZSIsIlN5c3RlbUJ1cyIsInBvc3RNZXNzYWdlIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2ZW50IiwiZGF0YSIsInR5cGUiLCJ0cmlnZ2VyIiwiaW50ZXJuYWxJZCIsInVuaXF1ZUlkcyIsImV2ZW50U3BsaXR0ZXIiLCJSb290Iiwib3B0aW9ucyIsIl9sYXllckV2ZW50U3Vic2NyaXB0aW9ucyIsIl9kZWxheWVkVHJpZ2dlcnMiLCJfbGFzdERlbGF5ZWRUcmlnZ2VyIiwiRGF0ZSIsIm5vdyIsIl9ldmVudHMiLCJuYW1lIiwiY29uc3RydWN0b3IiLCJvbiIsIl9wcm9jZXNzRGVsYXllZFRyaWdnZXJzIiwiaWQiLCJwcmVmaXhVVUlEIiwiZ2VuZXJhdGVVVUlEIiwia2V5IiwiX3N1cHBvcnRlZEV2ZW50cyIsImluZGV4T2YiLCJpc0luaXRpYWxpemluZyIsImlzRGVzdHJveWVkIiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiYWxyZWFkeURlc3Ryb3llZCIsIm9mZiIsImZvckVhY2giLCJpdGVtIiwibm9DaGlsZHJlbiIsIl9faW5Ub09iamVjdCIsIm9iaiIsImtleXMiLCJwdXNoIiwidiIsIkFycmF5IiwiaXNBcnJheSIsInRvT2JqZWN0IiwiZSIsImV2ZW50TmFtZSIsImluY2x1ZGVzIiwidG9TdHJpbmciLCJoYW5kbGVyIiwiY29udGV4dCIsInRlc3QiLCJuYW1lcyIsInNwbGl0IiwiX3dhcm5Gb3JFdmVudCIsIm4iLCJPYmplY3QiLCJrZXlOYW1lIiwiX3ByZXBhcmVPbiIsImFwcGx5Iiwib25jZSIsIl9kaXNhYmxlRXZlbnRzIiwiX3RyaWdnZXIiLCJfaWdub3JlZEV2ZW50cyIsImVycm9yIiwiY29tcHV0ZWRBcmdzIiwiX2dldFRyaWdnZXJBcmdzIiwicGFyZW50UHJvcCIsImJ1YmJsZUV2ZW50UGFyZW50IiwicGFyZW50VmFsdWUiLCJhcmdzIiwic2xpY2UiLCJjYWxsIiwibmV3QXJnIiwidGFyZ2V0Iiwic2hvdWxkU2NoZWR1bGVUcmlnZ2VyIiwibGVuZ3RoIiwiamFzbWluZSIsIm1lc3NhZ2VEYXRhIiwiZG9jdW1lbnQiLCJ3aW5kb3ciLCJzZXRUaW1lb3V0IiwiZXZlbnRzIiwibmV3VGFyZ2V0IiwiZmlyc3RFdnQiLCJmaXJzdEV2dFByb3AiLCJldnQiLCJpIiwic3BsaWNlIiwiZmlsdGVyIiwiaXNDaGFuZ2UiLCJfbWVyZ2VDaGFuZ2VzIiwiX2ZvbGRDaGFuZ2VFdmVudHMiLCJkZWZpbmVQcm9wZXJ0eSIsIm5ld0NsYXNzIiwicHJvcGVydHlOYW1lIiwicEtleSIsImNhbWVsIiwic3Vic3RyaW5nIiwidG9VcHBlckNhc2UiLCJoYXNEZWZpbml0aW9ucyIsImVudW1lcmFibGUiLCJnZXQiLCJzZXQiLCJpblZhbHVlIiwiaW5pdGlhbCIsInJlc3VsdCIsInVuZGVmaW5lZCIsImluaXRDbGFzcyIsImNsYXNzTmFtZSIsImhhc093blByb3BlcnR5IiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFNQSxRQUFRQyxRQUFRLGdCQUFSLENBQWQ7QUFDQSxJQUFNQyxhQUFhRCxRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNRSxhQUFhRixRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNRyxTQUFTSCxRQUFRLHVEQUFSLENBQWY7QUFDQSxJQUFNSSxTQUFTSixRQUFRLFVBQVIsQ0FBZjs7QUFFQTs7Ozs7QUFLQSxTQUFTSyxVQUFULEdBQXNCLENBQUc7QUFDekJBLFdBQVdDLFNBQVgsR0FBdUJILE1BQXZCOztBQUVBLElBQU1JLFlBQVksSUFBSUYsVUFBSixFQUFsQjtBQUNBLElBQUksT0FBT0csV0FBUCxLQUF1QixVQUEzQixFQUF1QztBQUNyQ0MsbUJBQWlCLFNBQWpCLEVBQTRCLFVBQUNDLEtBQUQsRUFBVztBQUNyQyxR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Q0FBZUosU0FBZixHQUEyQkEsU0FBM0IiLCJmaWxlIjoicm9vdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IExheWVyRXZlbnQgPSByZXF1aXJlKCcuL2xheWVyLWV2ZW50Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuY29uc3QgRXZlbnRzID0gcmVxdWlyZSgnYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmUvYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmUnKTtcbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5cbi8qXG4gKiBQcm92aWRlcyBhIHN5c3RlbSBidXMgdGhhdCBjYW4gYmUgYWNjZXNzZWQgYnkgYWxsIGNvbXBvbmVudHMgb2YgdGhlIHN5c3RlbS5cbiAqIEN1cnJlbnRseSB1c2VkIHRvIGxpc3RlbiB0byBtZXNzYWdlcyBzZW50IHZpYSBwb3N0TWVzc2FnZSwgYnV0IGVudmlzaW9uZWQgdG9cbiAqIGRvIGZhciBtb3JlLlxuICovXG5mdW5jdGlvbiBFdmVudENsYXNzKCkgeyB9XG5FdmVudENsYXNzLnByb3RvdHlwZSA9IEV2ZW50cztcblxuY29uc3QgU3lzdGVtQnVzID0gbmV3IEV2ZW50Q2xhc3MoKTtcbmlmICh0eXBlb2YgcG9zdE1lc3NhZ2UgPT09ICdmdW5jdGlvbicpIHtcbiAgYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIChldmVudCkgPT4ge1xuICAgIGlmIChldmVudC5kYXRhLnR5cGUgPT09ICdsYXllci1kZWxheWVkLWV2ZW50Jykge1xuICAgICAgU3lzdGVtQnVzLnRyaWdnZXIoZXZlbnQuZGF0YS5pbnRlcm5hbElkICsgJy1kZWxheWVkLWV2ZW50Jyk7XG4gICAgfVxuICB9KTtcbn1cblxuLy8gVXNlZCB0byBnZW5lcmF0ZSBhIHVuaXF1ZSBpbnRlcm5hbElkIGZvciBldmVyeSBSb290IGluc3RhbmNlXG5jb25zdCB1bmlxdWVJZHMgPSB7fTtcblxuLy8gUmVnZXggZm9yIHNwbGl0dGluZyBhbiBldmVudCBzdHJpbmcgc3VjaCBhcyBvYmoub24oJ2V2dE5hbWUxIGV2dE5hbWUyIGV2dE5hbWUzJylcbmNvbnN0IGV2ZW50U3BsaXR0ZXIgPSAvXFxzKy87XG5cbi8qKlxuICogVGhlIHJvb3QgY2xhc3Mgb2YgYWxsIGxheWVyIG9iamVjdHMuIFByb3ZpZGVzIHRoZSBmb2xsb3dpbmcgdXRpbGl0aWVzXG4gKlxuICogMS4gTWl4ZXMgaW4gdGhlIEJhY2tib25lIGV2ZW50IG1vZGVsXG4gKlxuICogICAgICAgIHZhciBwZXJzb24gPSBuZXcgUGVyc29uKCk7XG4gKiAgICAgICAgcGVyc29uLm9uKCdkZXN0cm95JywgZnVuY3Rpb24oKSB7XG4gKiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJIGhhdmUgYmVlbiBkZXN0cm95ZWQhJyk7XG4gKiAgICAgICAgfSk7XG4gKlxuICogICAgICAgIC8vIEZpcmUgdGhlIGNvbnNvbGUgbG9nIGhhbmRsZXI6XG4gKiAgICAgICAgcGVyc29uLnRyaWdnZXIoJ2Rlc3Ryb3knKTtcbiAqXG4gKiAgICAgICAgLy8gVW5zdWJzY3JpYmVcbiAqICAgICAgICBwZXJzb24ub2ZmKCdkZXN0cm95Jyk7XG4gKlxuICogMi4gQWRkcyBhIHN1YnNjcmlwdGlvbnMgb2JqZWN0IHNvIHRoYXQgYW55IGV2ZW50IGhhbmRsZXJzIG9uIGFuIG9iamVjdCBjYW4gYmUgcXVpY2tseSBmb3VuZCBhbmQgcmVtb3ZlZFxuICpcbiAqICAgICAgICB2YXIgcGVyc29uMSA9IG5ldyBQZXJzb24oKTtcbiAqICAgICAgICB2YXIgcGVyc29uMiA9IG5ldyBQZXJzb24oKTtcbiAqICAgICAgICBwZXJzb24yLm9uKCdkZXN0cm95JywgZnVuY3Rpb24oKSB7XG4gKiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJIGhhdmUgYmVlbiBkZXN0cm95ZWQhJyk7XG4gKiAgICAgICAgfSwgcGVyc29uMSk7XG4gKlxuICogICAgICAgIC8vIFBvaW50ZXJzIHRvIHBlcnNvbjEgaGVsZCBvbnRvIGJ5IHBlcnNvbjIgYXJlIHJlbW92ZWRcbiAqICAgICAgICBwZXJzb24xLmRlc3Ryb3koKTtcbiAqXG4gKiAzLiBBZGRzIHN1cHBvcnQgZm9yIGV2ZW50IGxpc3RlbmVycyBpbiB0aGUgY29uc3RydWN0b3JcbiAqICAgIEFueSBldmVudCBoYW5kbGVyIGNhbiBiZSBwYXNzZWQgaW50byB0aGUgY29uc3RydWN0b3JcbiAqICAgIGp1c3QgYXMgdGhvdWdoIGl0IHdlcmUgYSBwcm9wZXJ0eS5cbiAqXG4gKiAgICAgICAgdmFyIHBlcnNvbiA9IG5ldyBQZXJzb24oe1xuICogICAgICAgICAgICBhZ2U6IDE1MCxcbiAqICAgICAgICAgICAgZGVzdHJveTogZnVuY3Rpb24oKSB7XG4gKiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSSBoYXZlIGJlZW4gZGVzdHJveWVkIScpO1xuICogICAgICAgICAgICB9XG4gKiAgICAgICAgfSk7XG4gKlxuICogNC4gQSBfZGlzYWJsZUV2ZW50cyBwcm9wZXJ0eVxuICpcbiAqICAgICAgICBteU1ldGhvZCgpIHtcbiAqICAgICAgICAgIGlmICh0aGlzLmlzSW5pdGlhbGl6aW5nKSB7XG4gKiAgICAgICAgICAgICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IHRydWU7XG4gKlxuICogICAgICAgICAgICAgIC8vIEV2ZW50IG9ubHkgcmVjZWl2ZWQgaWYgX2Rpc2FibGVFdmVudHMgPSBmYWxzZVxuICogICAgICAgICAgICAgIHRoaXMudHJpZ2dlcignZGVzdHJveScpO1xuICogICAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcbiAqICAgICAgICAgIH1cbiAqICAgICAgICB9XG4gKlxuICogNS4gQSBfc3VwcG9ydGVkRXZlbnRzIHN0YXRpYyBwcm9wZXJ0eSBmb3IgZWFjaCBjbGFzc1xuICpcbiAqICAgICBUaGlzIHByb3BlcnR5IGRlZmluZXMgd2hpY2ggZXZlbnRzIGNhbiBiZSB0cmlnZ2VyZWQuXG4gKlxuICogICAgICogQW55IGF0dGVtcHQgdG8gdHJpZ2dlclxuICogICAgICAgYW4gZXZlbnQgbm90IGluIF9zdXBwb3J0ZWRFdmVudHMgd2lsbCBsb2cgYW4gZXJyb3IuXG4gKiAgICAgKiBBbnkgYXR0ZW1wdCB0byByZWdpc3RlciBhIGxpc3RlbmVyIGZvciBhbiBldmVudCBub3QgaW4gX3N1cHBvcnRlZEV2ZW50cyB3aWxsXG4gKiAgICAgKnRocm93KiBhbiBlcnJvci5cbiAqXG4gKiAgICAgVGhpcyBhbGxvd3MgdXMgdG8gaW5zdXJlIGRldmVsb3BlcnMgb25seSBzdWJzY3JpYmUgdG8gdmFsaWQgZXZlbnRzLlxuICpcbiAqICAgICBUaGlzIGFsbG93cyB1cyB0byBjb250cm9sIHdoYXQgZXZlbnRzIGNhbiBiZSBmaXJlZCBhbmQgd2hpY2ggb25lcyBibG9ja2VkLlxuICpcbiAqIDYuIEFkZHMgYW4gaW50ZXJuYWxJZCBwcm9wZXJ0eVxuICpcbiAqICAgICAgICB2YXIgcGVyc29uID0gbmV3IFBlcnNvbigpO1xuICogICAgICAgIGNvbnNvbGUubG9nKHBlcnNvbi5pbnRlcm5hbElkKTsgLy8gLT4gJ1BlcnNvbjEnXG4gKlxuICogNy4gQWRkcyBhIHRvT2JqZWN0IG1ldGhvZCB0byBjcmVhdGUgYSBzaW1wbGlmaWVkIFBsYWluIE9sZCBKYXZhY3JpcHQgT2JqZWN0IGZyb20geW91ciBvYmplY3RcbiAqXG4gKiAgICAgICAgdmFyIHBlcnNvbiA9IG5ldyBQZXJzb24oKTtcbiAqICAgICAgICB2YXIgc2ltcGxlUGVyc29uID0gcGVyc29uLnRvT2JqZWN0KCk7XG4gKlxuICogOC4gUHJvdmlkZXMgX19hZGp1c3RQcm9wZXJ0eSBtZXRob2Qgc3VwcG9ydFxuICpcbiAqICAgICBGb3IgYW55IHByb3BlcnR5IG9mIGEgY2xhc3MsIGFuIGBfX2FkanVzdFByb3BlcnR5YCBtZXRob2QgY2FuIGJlIGRlZmluZWQuICBJZiBpdHMgZGVmaW5lZCxcbiAqICAgICBpdCB3aWxsIGJlIGNhbGxlZCBwcmlvciB0byBzZXR0aW5nIHRoYXQgcHJvcGVydHksIGFsbG93aW5nOlxuICpcbiAqICAgICBBLiBNb2RpZmljYXRpb24gb2YgdGhlIHZhbHVlIHRoYXQgaXMgYWN0dWFsbHkgc2V0XG4gKiAgICAgQi4gVmFsaWRhdGlvbiBvZiB0aGUgdmFsdWU7IHRocm93aW5nIGVycm9ycyBpZiBpbnZhbGlkLlxuICpcbiAqIDkuIFByb3ZpZGVzIF9fdWRwYXRlUHJvcGVydHkgbWV0aG9kIHN1cHBvcnRcbiAqXG4gKiAgICAgQWZ0ZXIgc2V0dGluZyBhbnkgcHJvcGVydHkgZm9yIHdoaWNoIHRoZXJlIGlzIGFuIGBfX3VwZGF0ZVByb3BlcnR5YCBtZXRob2QgZGVmaW5lZCxcbiAqICAgICB0aGUgbWV0aG9kIHdpbGwgYmUgY2FsbGVkLCBhbGxvd2luZyB0aGUgbmV3IHByb3BlcnR5IHRvIGJlIGFwcGxpZWQuXG4gKlxuICogICAgIFR5cGljYWxseSB1c2VkIGZvclxuICpcbiAqICAgICBBLiBUcmlnZ2VyaW5nIGV2ZW50c1xuICogICAgIEIuIEZpcmluZyBYSFIgcmVxdWVzdHNcbiAqICAgICBDLiBVcGRhdGluZyB0aGUgVUkgdG8gbWF0Y2ggdGhlIG5ldyBwcm9wZXJ0eSB2YWx1ZVxuICpcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuUm9vdFxuICogQGFic3RyYWN0XG4gKiBAYXV0aG9yIE1pY2hhZWwgS2FudG9yXG4gKi9cbmNsYXNzIFJvb3QgZXh0ZW5kcyBFdmVudENsYXNzIHtcblxuICAvKipcbiAgICogU3VwZXJjbGFzcyBjb25zdHJ1Y3RvciBoYW5kbGVzIGNvcHlpbmcgaW4gcHJvcGVydGllcyBhbmQgcmVnaXN0ZXJpbmcgZXZlbnQgaGFuZGxlcnMuXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zIC0gYSBoYXNoIG9mIHByb3BlcnRpZXMgYW5kIGV2ZW50IGhhbmRsZXJzXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX2xheWVyRXZlbnRTdWJzY3JpcHRpb25zID0gW107XG4gICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzID0gW107XG4gICAgdGhpcy5fbGFzdERlbGF5ZWRUcmlnZ2VyID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAgIC8vIEdlbmVyYXRlIGFuIGludGVybmFsSWRcbiAgICBjb25zdCBuYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIGlmICghdW5pcXVlSWRzW25hbWVdKSB1bmlxdWVJZHNbbmFtZV0gPSAwO1xuICAgIHRoaXMuaW50ZXJuYWxJZCA9IG5hbWUgKyB1bmlxdWVJZHNbbmFtZV0rKztcblxuICAgIC8vIEV2ZXJ5IGNvbXBvbmVudCBsaXN0ZW5zIHRvIHRoZSBTeXN0ZW1CdXMgZm9yIHBvc3RNZXNzYWdlICh0cmlnZ2VyQXN5bmMpIGV2ZW50c1xuICAgIFN5c3RlbUJ1cy5vbih0aGlzLmludGVybmFsSWQgKyAnLWRlbGF5ZWQtZXZlbnQnLCB0aGlzLl9wcm9jZXNzRGVsYXllZFRyaWdnZXJzLCB0aGlzKTtcblxuICAgIC8vIEdlbmVyYXRlIGEgdGVtcG9yYXJ5IGlkIGlmIHRoZXJlIGlzbid0IGFuIGlkXG4gICAgaWYgKCF0aGlzLmlkICYmICFvcHRpb25zLmlkICYmIHRoaXMuY29uc3RydWN0b3IucHJlZml4VVVJRCkge1xuICAgICAgdGhpcy5pZCA9IHRoaXMuY29uc3RydWN0b3IucHJlZml4VVVJRCArIFV0aWxzLmdlbmVyYXRlVVVJRCgpO1xuICAgIH1cblxuICAgIC8vIENvcHkgaW4gYWxsIHByb3BlcnRpZXM7IHNldHVwIGFsbCBldmVudCBoYW5kbGVyc1xuICAgIGxldCBrZXk7XG4gICAgZm9yIChrZXkgaW4gb3B0aW9ucykge1xuICAgICAgaWYgKHRoaXMuY29uc3RydWN0b3IuX3N1cHBvcnRlZEV2ZW50cy5pbmRleE9mKGtleSkgIT09IC0xKSB7XG4gICAgICAgIHRoaXMub24oa2V5LCBvcHRpb25zW2tleV0pO1xuICAgICAgfSBlbHNlIGlmIChrZXkgaW4gdGhpcyAmJiB0eXBlb2YgdGhpc1trZXldICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXNba2V5XSA9IG9wdGlvbnNba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3lzIHRoZSBvYmplY3QuXG4gICAqXG4gICAqIENsZWFucyB1cCBhbGwgZXZlbnRzIC8gc3Vic2NyaXB0aW9uc1xuICAgKiBhbmQgbWFya3MgdGhlIG9iamVjdCBhcyBpc0Rlc3Ryb3llZC5cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmFscmVhZHlEZXN0cm95ZWQpO1xuXG4gICAgLy8gSWYgYW55b25lIGlzIGxpc3RlbmluZywgbm90aWZ5IHRoZW1cbiAgICB0aGlzLnRyaWdnZXIoJ2Rlc3Ryb3knKTtcblxuICAgIC8vIENsZWFudXAgcG9pbnRlcnMgdG8gU3lzdGVtQnVzLiBGYWlsdXJlIHRvIGNhbGwgZGVzdHJveVxuICAgIC8vIHdpbGwgaGF2ZSB2ZXJ5IHNlcmlvdXMgY29uc2VxdWVuY2VzLi4uXG4gICAgU3lzdGVtQnVzLm9mZih0aGlzLmludGVybmFsSWQgKyAnLWRlbGF5ZWQtZXZlbnQnLCBudWxsLCB0aGlzKTtcblxuICAgIC8vIFJlbW92ZSBhbGwgZXZlbnRzLCBhbmQgYWxsIHBvaW50ZXJzIHBhc3NlZCB0byB0aGlzIG9iamVjdCBieSBvdGhlciBvYmplY3RzXG4gICAgdGhpcy5vZmYoKTtcblxuICAgIC8vIEZpbmQgYWxsIG9mIHRoZSBvYmplY3RzIHRoYXQgdGhpcyBvYmplY3QgaGFzIHBhc3NlZCBpdHNlbGYgdG8gaW4gdGhlIGZvcm1cbiAgICAvLyBvZiBldmVudCBoYW5kbGVycyBhbmQgcmVtb3ZlIGFsbCByZWZlcmVuY2VzIHRvIGl0c2VsZi5cbiAgICB0aGlzLl9sYXllckV2ZW50U3Vic2NyaXB0aW9ucy5mb3JFYWNoKGl0ZW0gPT4gaXRlbS5vZmYobnVsbCwgbnVsbCwgdGhpcykpO1xuXG4gICAgdGhpcy5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMgPSBudWxsO1xuICAgIHRoaXMuX2RlbGF5ZWRUcmlnZ2VycyA9IG51bGw7XG4gICAgdGhpcy5pc0Rlc3Ryb3llZCA9IHRydWU7XG4gIH1cblxuICBzdGF0aWMgaXNWYWxpZElkKGlkKSB7XG4gICAgcmV0dXJuIGlkLmluZGV4T2YodGhpcy5wcmVmaXhVVUlEKSA9PT0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGNsYXNzIGluc3RhbmNlIHRvIFBsYWluIEphdmFzY3JpcHQgT2JqZWN0LlxuICAgKlxuICAgKiBTdHJpcHMgb3V0IGFsbCBwcml2YXRlIG1lbWJlcnMsIGFuZCBpbnN1cmVzIG5vIGRhdGFzdHJ1Y3R1cmUgbG9vcHMuXG4gICAqIFJlY3Vyc2l2ZWx5IGNvbnZlcnRpbmcgYWxsIHN1Ym9iamVjdHMgdXNpbmcgY2FsbHMgdG8gdG9PYmplY3QuXG4gICAqXG4gICAqICAgICAgY29uc29sZS5kaXIobXlvYmoudG9PYmplY3QoKSk7XG4gICAqXG4gICAqIE5vdGU6IFdoaWxlIGl0IHdvdWxkIGJlIHRlbXB0aW5nIHRvIGhhdmUgbm9DaGlsZHJlbiBkZWZhdWx0IHRvIHRydWUsXG4gICAqIHRoaXMgd291bGQgcmVzdWx0IGluIE1lc3NhZ2UudG9PYmplY3QoKSBub3Qgb3V0cHV0aW5nIGl0cyBNZXNzYWdlUGFydHMuXG4gICAqXG4gICAqIFByaXZhdGUgZGF0YSAoXyBwcmVmaXhlZCBwcm9wZXJ0aWVzKSB3aWxsIG5vdCBiZSBvdXRwdXQuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gW25vQ2hpbGRyZW49ZmFsc2VdIERvbid0IG91dHB1dCBzdWItY29tcG9uZW50c1xuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICB0b09iamVjdChub0NoaWxkcmVuID0gZmFsc2UpIHtcbiAgICB0aGlzLl9faW5Ub09iamVjdCA9IHRydWU7XG4gICAgY29uc3Qgb2JqID0ge307XG5cbiAgICAvLyBJdGVyYXRlIG92ZXIgYWxsIGZvcm1hbGx5IGRlZmluZWQgcHJvcGVydGllc1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBrZXlzID0gW107XG4gICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5jb25zdHJ1Y3Rvci5wcm90b3R5cGUpIGlmICghKGtleSBpbiBSb290LnByb3RvdHlwZSkpIGtleXMucHVzaChrZXkpO1xuXG4gICAgICBrZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgY29uc3QgdiA9IHRoaXNba2V5XTtcblxuICAgICAgICAvLyBJZ25vcmUgcHJpdmF0ZS9wcm90ZWN0ZWQgcHJvcGVydGllcyBhbmQgZnVuY3Rpb25zXG4gICAgICAgIGlmIChrZXkuaW5kZXhPZignXycpID09PSAwKSByZXR1cm47XG4gICAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuO1xuXG4gICAgICAgIC8vIEdlbmVyYXRlIGFycmF5cy4uLlxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2KSkge1xuICAgICAgICAgIG9ialtrZXldID0gW107XG4gICAgICAgICAgdi5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBSb290KSB7XG4gICAgICAgICAgICAgIGlmIChub0NoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIG9ialtrZXldO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFpdGVtLl9faW5Ub09iamVjdCkge1xuICAgICAgICAgICAgICAgIG9ialtrZXldLnB1c2goaXRlbS50b09iamVjdCgpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2JqW2tleV0ucHVzaChpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIHN1YmNvbXBvbmVudHNcbiAgICAgICAgZWxzZSBpZiAodiBpbnN0YW5jZW9mIFJvb3QpIHtcbiAgICAgICAgICBpZiAoIXYuX19pblRvT2JqZWN0ICYmICFub0NoaWxkcmVuKSB7XG4gICAgICAgICAgICBvYmpba2V5XSA9IHYudG9PYmplY3QoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSBkYXRlcyAoY3JlYXRlcyBhIGNvcHkgdG8gc2VwYXJhdGUgaXQgZnJvbSB0aGUgc291cmNlIG9iamVjdClcbiAgICAgICAgZWxzZSBpZiAodiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICBvYmpba2V5XSA9IG5ldyBEYXRlKHYpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgc2ltcGxlIHByb3BlcnRpZXNcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgb2JqW2tleV0gPSB2O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBuby1vcFxuICAgIH1cbiAgICB0aGlzLl9faW5Ub09iamVjdCA9IGZhbHNlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvKipcbiAgICogTG9nIGEgd2FybmluZyBmb3IgYXR0ZW1wdHMgdG8gc3Vic2NyaWJlIHRvIHVuc3VwcG9ydGVkIGV2ZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBfd2FybkZvckV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfd2FybkZvckV2ZW50KGV2ZW50TmFtZSkge1xuICAgIGlmICghVXRpbHMuaW5jbHVkZXModGhpcy5jb25zdHJ1Y3Rvci5fc3VwcG9ydGVkRXZlbnRzLCBldmVudE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V2ZW50ICcgKyBldmVudE5hbWUgKyAnIG5vdCBkZWZpbmVkIGZvciAnICsgdGhpcy50b1N0cmluZygpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJlcGFyZSBmb3IgcHJvY2Vzc2luZyBhbiBldmVudCBzdWJzY3JpcHRpb24gY2FsbC5cbiAgICpcbiAgICogSWYgY29udGV4dCBpcyBhIFJvb3QgY2xhc3MsIGFkZCB0aGlzIG9iamVjdCB0byB0aGUgY29udGV4dCdzIHN1YnNjcmlwdGlvbnMuXG4gICAqXG4gICAqIEBtZXRob2QgX3ByZXBhcmVPblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3ByZXBhcmVPbihuYW1lLCBoYW5kbGVyLCBjb250ZXh0KSB7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGlmIChjb250ZXh0IGluc3RhbmNlb2YgUm9vdCkge1xuICAgICAgICBpZiAoY29udGV4dC5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoY29udGV4dC5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMpIHtcbiAgICAgICAgY29udGV4dC5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJyAmJiBuYW1lICE9PSAnYWxsJykge1xuICAgICAgaWYgKGV2ZW50U3BsaXR0ZXIudGVzdChuYW1lKSkge1xuICAgICAgICBjb25zdCBuYW1lcyA9IG5hbWUuc3BsaXQoZXZlbnRTcGxpdHRlcik7XG4gICAgICAgIG5hbWVzLmZvckVhY2gobiA9PiB0aGlzLl93YXJuRm9yRXZlbnQobikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fd2FybkZvckV2ZW50KG5hbWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIE9iamVjdC5rZXlzKG5hbWUpLmZvckVhY2goa2V5TmFtZSA9PiB0aGlzLl93YXJuRm9yRXZlbnQoa2V5TmFtZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTdWJzY3JpYmUgdG8gZXZlbnRzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhlIGNvbnRleHQgcGFyYW1ldGVyIHNlcnZlcyBkb3VibGUgaW1wb3J0YW5jZSBoZXJlOlxuICAgKlxuICAgKiAxLiBJdCBkZXRlcm1pbmVzIHRoZSBjb250ZXh0IGluIHdoaWNoIHRvIGV4ZWN1dGUgdGhlIGV2ZW50IGhhbmRsZXJcbiAgICogMi4gQ3JlYXRlIGEgYmFja2xpbmsgc28gdGhhdCBpZiBlaXRoZXIgc3Vic2NyaWJlciBvciBzdWJzY3JpYmVlIGlzIGRlc3Ryb3llZCxcbiAgICogICAgYWxsIHBvaW50ZXJzIGJldHdlZW4gdGhlbSBjYW4gYmUgZm91bmQgYW5kIHJlbW92ZWQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBvYmoub24oJ3NvbWVFdmVudE5hbWUgc29tZU90aGVyRXZlbnROYW1lJywgbXljYWxsYmFjaywgbXljb250ZXh0KTtcbiAgICogYGBgXG4gICAqXG4gICAqIGBgYFxuICAgKiBvYmoub24oe1xuICAgKiAgICBldmVudE5hbWUxOiBjYWxsYmFjazEsXG4gICAqICAgIGV2ZW50TmFtZTI6IGNhbGxiYWNrMlxuICAgKiB9LCBteWNvbnRleHQpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBvblxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBldmVudFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gaGFuZGxlciAtIEV2ZW50IGhhbmRsZXJcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gaGFuZGxlci5ldmVudCAtIEV2ZW50IG9iamVjdCBkZWxpdmVyZWQgdG8gdGhlIGhhbmRsZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb250ZXh0IC0gVGhpcyBwb2ludGVyIEFORCBsaW5rIHRvIGhlbHAgd2l0aCBjbGVhbnVwXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9IHRoaXNcbiAgICovXG4gIG9uKG5hbWUsIGhhbmRsZXIsIGNvbnRleHQpIHtcbiAgICB0aGlzLl9wcmVwYXJlT24obmFtZSwgaGFuZGxlciwgY29udGV4dCk7XG4gICAgRXZlbnRzLm9uLmFwcGx5KHRoaXMsIFtuYW1lLCBoYW5kbGVyLCBjb250ZXh0XSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU3Vic2NyaWJlIHRvIHRoZSBmaXJzdCBvY2N1cmFuY2Ugb2YgdGhlIHNwZWNpZmllZCBldmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBvbmNlXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9IHRoaXNcbiAgICovXG4gIG9uY2UobmFtZSwgaGFuZGxlciwgY29udGV4dCkge1xuICAgIHRoaXMuX3ByZXBhcmVPbihuYW1lLCBoYW5kbGVyLCBjb250ZXh0KTtcbiAgICBFdmVudHMub25jZS5hcHBseSh0aGlzLCBbbmFtZSwgaGFuZGxlciwgY29udGV4dF0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuc3Vic2NyaWJlIGZyb20gZXZlbnRzLlxuICAgKlxuICAgKiBgYGBcbiAgICogLy8gUmVtb3ZlcyBhbGwgZXZlbnQgaGFuZGxlcnMgZm9yIHRoaXMgZXZlbnQ6XG4gICAqIG9iai5vZmYoJ3NvbWVFdmVudE5hbWUnKTtcbiAgICpcbiAgICogLy8gUmVtb3ZlcyBhbGwgZXZlbnQgaGFuZGxlcnMgdXNpbmcgdGhpcyBmdW5jdGlvbiBwb2ludGVyIGFzIGNhbGxiYWNrXG4gICAqIG9iai5vZmYobnVsbCwgZiwgbnVsbCk7XG4gICAqXG4gICAqIC8vIFJlbW92ZXMgYWxsIGV2ZW50IGhhbmRsZXJzIHRoYXQgYHRoaXNgIGhhcyBzdWJzY3JpYmVkIHRvOyByZXF1aXJlc1xuICAgKiAvLyBvYmoub24gdG8gYmUgY2FsbGVkIHdpdGggYHRoaXNgIGFzIGl0cyBgY29udGV4dGAgcGFyYW1ldGVyLlxuICAgKiBvYmoub2ZmKG51bGwsIG51bGwsIHRoaXMpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBvZmZcbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQ7IG51bGwgZm9yIGFsbCBldmVudCBuYW1lc1xuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gaGFuZGxlciAtIEV2ZW50IGhhbmRsZXI7IG51bGwgZm9yIGFsbCBmdW5jdGlvbnNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb250ZXh0IC0gVGhlIGNvbnRleHQgZnJvbSB0aGUgYG9uKClgIGNhbGwgdG8gc2VhcmNoIGZvcjsgbnVsbCBmb3IgYWxsIGNvbnRleHRzXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9IHRoaXNcbiAgICovXG5cblxuICAvKipcbiAgICogVHJpZ2dlciBhbiBldmVudCBmb3IgYW55IGV2ZW50IGxpc3RlbmVycy5cbiAgICpcbiAgICogRXZlbnRzIHRyaWdnZXJlZCB0aGlzIHdheSB3aWxsIGJlIGJsb2NrZWQgaWYgX2Rpc2FibGVFdmVudHMgPSB0cnVlXG4gICAqXG4gICAqIEBtZXRob2QgdHJpZ2dlclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lICAgIE5hbWUgb2YgdGhlIGV2ZW50IHRoYXQgb25lIHNob3VsZCBzdWJzY3JpYmUgdG8gaW4gb3JkZXIgdG8gcmVjZWl2ZSB0aGlzIGV2ZW50XG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFyZyAgICAgICAgICAgVmFsdWVzIHRoYXQgd2lsbCBiZSBwbGFjZWQgd2l0aGluIGEgbGF5ZXIuTGF5ZXJFdmVudFxuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fSB0aGlzXG4gICAqL1xuICB0cmlnZ2VyKC4uLmFyZ3MpIHtcbiAgICBpZiAodGhpcy5fZGlzYWJsZUV2ZW50cykgcmV0dXJuIHRoaXM7XG4gICAgcmV0dXJuIHRoaXMuX3RyaWdnZXIoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogVHJpZ2dlcnMgYW4gZXZlbnQuXG4gICAqXG4gICAqIEBtZXRob2QgdHJpZ2dlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lICAgIE5hbWUgb2YgdGhlIGV2ZW50IHRoYXQgb25lIHNob3VsZCBzdWJzY3JpYmUgdG8gaW4gb3JkZXIgdG8gcmVjZWl2ZSB0aGlzIGV2ZW50XG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFyZyAgICAgICAgICAgVmFsdWVzIHRoYXQgd2lsbCBiZSBwbGFjZWQgd2l0aGluIGEgbGF5ZXIuTGF5ZXJFdmVudFxuICAgKi9cbiAgX3RyaWdnZXIoLi4uYXJncykge1xuICAgIGlmICghVXRpbHMuaW5jbHVkZXModGhpcy5jb25zdHJ1Y3Rvci5fc3VwcG9ydGVkRXZlbnRzLCBhcmdzWzBdKSkge1xuICAgICAgaWYgKCFVdGlscy5pbmNsdWRlcyh0aGlzLmNvbnN0cnVjdG9yLl9pZ25vcmVkRXZlbnRzLCBhcmdzWzBdKSkge1xuICAgICAgICBMb2dnZXIuZXJyb3IodGhpcy50b1N0cmluZygpICsgJyBpZ25vcmVkICcgKyBhcmdzWzBdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb21wdXRlZEFyZ3MgPSB0aGlzLl9nZXRUcmlnZ2VyQXJncyguLi5hcmdzKTtcblxuICAgIEV2ZW50cy50cmlnZ2VyLmFwcGx5KHRoaXMsIGNvbXB1dGVkQXJncyk7XG5cbiAgICBjb25zdCBwYXJlbnRQcm9wID0gdGhpcy5jb25zdHJ1Y3Rvci5idWJibGVFdmVudFBhcmVudDtcbiAgICBpZiAocGFyZW50UHJvcCkge1xuICAgICAgbGV0IHBhcmVudFZhbHVlID0gdGhpc1twYXJlbnRQcm9wXTtcbiAgICAgIHBhcmVudFZhbHVlID0gKHR5cGVvZiBwYXJlbnRWYWx1ZSA9PT0gJ2Z1bmN0aW9uJykgPyBwYXJlbnRWYWx1ZS5hcHBseSh0aGlzKSA6IHBhcmVudFZhbHVlO1xuICAgICAgaWYgKHBhcmVudFZhbHVlKSBwYXJlbnRWYWx1ZS50cmlnZ2VyKC4uLmNvbXB1dGVkQXJncyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBhIGxheWVyLkxheWVyRXZlbnQgZnJvbSBhIHRyaWdnZXIgY2FsbCdzIGFyZ3VtZW50cy5cbiAgICpcbiAgICogKiBJZiBwYXJhbWV0ZXIgaXMgYWxyZWFkeSBhIGxheWVyLkxheWVyRXZlbnQsIHdlJ3JlIGRvbmUuXG4gICAqICogSWYgcGFyYW1ldGVyIGlzIGFuIG9iamVjdCwgYSBgdGFyZ2V0YCBwcm9wZXJ0eSBpcyBhZGRlZCB0byB0aGF0IG9iamVjdCBhbmQgaXRzIGRlbGl2ZXJlZCB0byBhbGwgc3Vic2NyaWJlcnNcbiAgICogKiBJZiB0aGUgcGFyYW1ldGVyIGlzIG5vbi1vYmplY3QgdmFsdWUsIGl0IGlzIGFkZGVkIHRvIGFuIG9iamVjdCB3aXRoIGEgYHRhcmdldGAgcHJvcGVydHksIGFuZCB0aGUgdmFsdWUgaXMgcHV0IGluXG4gICAqICAgdGhlIGBkYXRhYCBwcm9wZXJ0eS5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0VHJpZ2dlckFyZ3NcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7TWl4ZWRbXX0gLSBGaXJzdCBlbGVtZW50IG9mIGFycmF5IGlzIGV2ZW50TmFtZSwgc2Vjb25kIGVsZW1lbnQgaXMgbGF5ZXIuTGF5ZXJFdmVudC5cbiAgICovXG4gIF9nZXRUcmlnZ2VyQXJncyguLi5hcmdzKSB7XG4gICAgY29uc3QgY29tcHV0ZWRBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncyk7XG5cbiAgICBpZiAoYXJnc1sxXSkge1xuICAgICAgY29uc3QgbmV3QXJnID0geyB0YXJnZXQ6IHRoaXMgfTtcblxuICAgICAgaWYgKGNvbXB1dGVkQXJnc1sxXSBpbnN0YW5jZW9mIExheWVyRXZlbnQpIHtcbiAgICAgICAgLy8gQSBMYXllckV2ZW50IHdpbGwgYmUgYW4gYXJndW1lbnQgd2hlbiBidWJibGluZyBldmVudHMgdXA7IHRoZXNlIGFyZ3MgY2FuIGJlIHVzZWQgYXMtaXNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29tcHV0ZWRBcmdzWzFdID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIE9iamVjdC5rZXlzKGNvbXB1dGVkQXJnc1sxXSkuZm9yRWFjaChuYW1lID0+IHtuZXdBcmdbbmFtZV0gPSBjb21wdXRlZEFyZ3NbMV1bbmFtZV07fSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3QXJnLmRhdGEgPSBjb21wdXRlZEFyZ3NbMV07XG4gICAgICAgIH1cbiAgICAgICAgY29tcHV0ZWRBcmdzWzFdID0gbmV3IExheWVyRXZlbnQobmV3QXJnLCBjb21wdXRlZEFyZ3NbMF0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb21wdXRlZEFyZ3NbMV0gPSBuZXcgTGF5ZXJFdmVudCh7IHRhcmdldDogdGhpcyB9LCBjb21wdXRlZEFyZ3NbMF0pO1xuICAgIH1cblxuICAgIHJldHVybiBjb21wdXRlZEFyZ3M7XG4gIH1cblxuICAvKipcbiAgICogU2FtZSBhcyBfdHJpZ2dlcigpIG1ldGhvZCwgYnV0IGRlbGF5cyBicmllZmx5IGJlZm9yZSBmaXJpbmcuXG4gICAqXG4gICAqIFdoZW4gd291bGQgeW91IHdhbnQgdG8gZGVsYXkgYW4gZXZlbnQ/XG4gICAqXG4gICAqIDEuIFRoZXJlIGlzIGFuIGV2ZW50IHJvbGx1cCB0aGF0IG1heSBiZSBuZWVkZWQgZm9yIHRoZSBldmVudDtcbiAgICogICAgdGhpcyByZXF1aXJlcyB0aGUgZnJhbWV3b3JrIHRvIGJlIGFibGUgdG8gc2VlIEFMTCBldmVudHMgdGhhdCBoYXZlIGJlZW5cbiAgICogICAgZ2VuZXJhdGVkLCByb2xsIHRoZW0gdXAsIGFuZCBUSEVOIGZpcmUgdGhlbS5cbiAgICogMi4gVGhlIGV2ZW50IGlzIGludGVuZGVkIGZvciBVSSByZW5kZXJpbmcuLi4gd2hpY2ggc2hvdWxkIG5vdCBob2xkIHVwIHRoZSByZXN0IG9mXG4gICAqICAgIHRoaXMgZnJhbWV3b3JrJ3MgZXhlY3V0aW9uLlxuICAgKlxuICAgKiBXaGVuIE5PVCB0byBkZWxheSBhbiBldmVudD9cbiAgICpcbiAgICogMS4gTGlmZWN5Y2xlIGV2ZW50cyBmcmVxdWVudGx5IHJlcXVpcmUgcmVzcG9uc2UgYXQgdGhlIHRpbWUgdGhlIGV2ZW50IGhhcyBmaXJlZFxuICAgKlxuICAgKiBAbWV0aG9kIF90cmlnZ2VyQXN5bmNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZSAgICBOYW1lIG9mIHRoZSBldmVudCB0aGF0IG9uZSBzaG91bGQgc3Vic2NyaWJlIHRvIGluIG9yZGVyIHRvIHJlY2VpdmUgdGhpcyBldmVudFxuICAgKiBAcGFyYW0ge01peGVkfSBhcmcgICAgICAgICAgIFZhbHVlcyB0aGF0IHdpbGwgYmUgcGxhY2VkIHdpdGhpbiBhIGxheWVyLkxheWVyRXZlbnRcbiAgICogQHJldHVybiB7bGF5ZXIuUm9vdH0gdGhpc1xuICAgKi9cbiAgX3RyaWdnZXJBc3luYyguLi5hcmdzKSB7XG4gICAgY29uc3QgY29tcHV0ZWRBcmdzID0gdGhpcy5fZ2V0VHJpZ2dlckFyZ3MoLi4uYXJncyk7XG4gICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLnB1c2goY29tcHV0ZWRBcmdzKTtcblxuICAgIC8vIE5PVEU6IEl0IGlzIHVuY2xlYXIgYXQgdGhpcyB0aW1lIGhvdyBpdCBoYXBwZW5zLCBidXQgb24gdmVyeSByYXJlIG9jY2FzaW9ucywgd2Ugc2VlIHByb2Nlc3NEZWxheWVkVHJpZ2dlcnNcbiAgICAvLyBmYWlsIHRvIGdldCBjYWxsZWQgd2hlbiBsZW5ndGggPSAxLCBhbmQgYWZ0ZXIgdGhhdCBsZW5ndGgganVzdCBjb250aW51b3VzbHkgZ3Jvd3MuICBTbyB3ZSBhZGRcbiAgICAvLyB0aGUgX2xhc3REZWxheWVkVHJpZ2dlciB0ZXN0IHRvIGluc3VyZSB0aGF0IGl0IHdpbGwgc3RpbGwgcnVuLlxuICAgIGNvbnN0IHNob3VsZFNjaGVkdWxlVHJpZ2dlciA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5sZW5ndGggPT09IDEgfHxcbiAgICAgIHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5sZW5ndGggJiYgdGhpcy5fbGFzdERlbGF5ZWRUcmlnZ2VyICsgNTAwIDwgRGF0ZS5ub3coKTtcbiAgICBpZiAoc2hvdWxkU2NoZWR1bGVUcmlnZ2VyKSB7XG4gICAgICB0aGlzLl9sYXN0RGVsYXllZFRyaWdnZXIgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKHR5cGVvZiBwb3N0TWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgamFzbWluZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdmFyIG1lc3NhZ2VEYXRhID0ge1xuICAgICAgICAgIHR5cGU6ICdsYXllci1kZWxheWVkLWV2ZW50JyxcbiAgICAgICAgICBpbnRlcm5hbElkOiB0aGlzLmludGVybmFsSWQsXG4gICAgICAgIH07XG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKG1lc3NhZ2VEYXRhLCAnKicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFJlYWN0IE5hdGl2ZSByZXBvcnRlZGx5IGxhY2tzIGEgZG9jdW1lbnQsIGFuZCB0aHJvd3MgZXJyb3JzIG9uIHRoZSBzZWNvbmQgcGFyYW1ldGVyXG4gICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKG1lc3NhZ2VEYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLl9wcm9jZXNzRGVsYXllZFRyaWdnZXJzKCksIDApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDb21iaW5lcyBhIHNldCBvZiBldmVudHMgaW50byBhIHNpbmdsZSBldmVudC5cbiAgICpcbiAgICogR2l2ZW4gYW4gZXZlbnQgc3RydWN0dXJlIG9mXG4gICAqIGBgYFxuICAgKiAgICAgIHtcbiAgICogICAgICAgICAgY3VzdG9tTmFtZTogW3ZhbHVlMV1cbiAgICogICAgICB9XG4gICAqICAgICAge1xuICAgKiAgICAgICAgICBjdXN0b21OYW1lOiBbdmFsdWUyXVxuICAgKiAgICAgIH1cbiAgICogICAgICB7XG4gICAqICAgICAgICAgIGN1c3RvbU5hbWU6IFt2YWx1ZTNdXG4gICAqICAgICAgfVxuICAgKiBgYGBcbiAgICpcbiAgICogTWVyZ2UgdGhlbSBpbnRvXG4gICAqXG4gICAqIGBgYFxuICAgKiAgICAgIHtcbiAgICogICAgICAgICAgY3VzdG9tTmFtZTogW3ZhbHVlMSwgdmFsdWUyLCB2YWx1ZTNdXG4gICAqICAgICAgfVxuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBfZm9sZEV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckV2ZW50W119IGV2ZW50c1xuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG5hbWUgICAgICBOYW1lIG9mIHRoZSBwcm9wZXJ0eSAoaS5lLiAnY3VzdG9tTmFtZScpXG4gICAqIEBwYXJhbSAge2xheWVyLlJvb3R9ICAgIG5ld1RhcmdldCBWYWx1ZSBvZiB0aGUgdGFyZ2V0IGZvciB0aGUgZm9sZGVkIHJlc3VsdGluZyBldmVudFxuICAgKi9cbiAgX2ZvbGRFdmVudHMoZXZlbnRzLCBuYW1lLCBuZXdUYXJnZXQpIHtcbiAgICBjb25zdCBmaXJzdEV2dCA9IGV2ZW50cy5sZW5ndGggPyBldmVudHNbMF1bMV0gOiBudWxsO1xuICAgIGNvbnN0IGZpcnN0RXZ0UHJvcCA9IGZpcnN0RXZ0ID8gZmlyc3RFdnRbbmFtZV0gOiBudWxsO1xuICAgIGV2ZW50cy5mb3JFYWNoKChldnQsIGkpID0+IHtcbiAgICAgIGlmIChpID4gMCkge1xuICAgICAgICBmaXJzdEV2dFByb3AucHVzaChldnRbMV1bbmFtZV1bMF0pO1xuICAgICAgICB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuc3BsaWNlKHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5pbmRleE9mKGV2dCksIDEpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChldmVudHMubGVuZ3RoICYmIG5ld1RhcmdldCkgZXZlbnRzWzBdWzFdLnRhcmdldCA9IG5ld1RhcmdldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb2xkIGEgc2V0IG9mIENoYW5nZSBldmVudHMgaW50byBhIHNpbmdsZSBDaGFuZ2UgZXZlbnQuXG4gICAqXG4gICAqIEdpdmVuIGEgc2V0IGNoYW5nZSBldmVudHMgb24gdGhpcyBjb21wb25lbnQsXG4gICAqIGZvbGQgYWxsIGNoYW5nZSBldmVudHMgaW50byBhIHNpbmdsZSBldmVudCB2aWFcbiAgICogdGhlIGxheWVyLkxheWVyRXZlbnQncyBjaGFuZ2VzIGFycmF5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9mb2xkQ2hhbmdlRXZlbnRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZm9sZENoYW5nZUV2ZW50cygpIHtcbiAgICBjb25zdCBldmVudHMgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZmlsdGVyKGV2dCA9PiBldnRbMV0uaXNDaGFuZ2UpO1xuICAgIGV2ZW50cy5mb3JFYWNoKChldnQsIGkpID0+IHtcbiAgICAgIGlmIChpID4gMCkge1xuICAgICAgICBldmVudHNbMF1bMV0uX21lcmdlQ2hhbmdlcyhldnRbMV0pO1xuICAgICAgICB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuc3BsaWNlKHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5pbmRleE9mKGV2dCksIDEpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYWxsIGRlbGF5ZWQgZXZlbnRzIGZvciB0aGlzIGNvbXBvZW5udC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc0RlbGF5ZWRUcmlnZ2Vyc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Byb2Nlc3NEZWxheWVkVHJpZ2dlcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICB0aGlzLl9mb2xkQ2hhbmdlRXZlbnRzKCk7XG5cbiAgICB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZm9yRWFjaChmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICB0aGlzLnRyaWdnZXIoLi4uZXZ0KTtcbiAgICB9LCB0aGlzKTtcbiAgICB0aGlzLl9kZWxheWVkVHJpZ2dlcnMgPSBbXTtcbiAgfVxuXG5cblxuICAvKipcbiAgICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgY2xhc3MgdGhhdCBpcyBuaWNlciB0aGFuIGBbT2JqZWN0XWAuXG4gICAqXG4gICAqIEBtZXRob2QgdG9TdHJpbmdcbiAgICogQHJldHVybiB7U3RyaW5nfVxuICAgKi9cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW50ZXJuYWxJZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBkZWZpbmVQcm9wZXJ0eShuZXdDbGFzcywgcHJvcGVydHlOYW1lKSB7XG4gIGNvbnN0IHBLZXkgPSAnX18nICsgcHJvcGVydHlOYW1lO1xuICBjb25zdCBjYW1lbCA9IHByb3BlcnR5TmFtZS5zdWJzdHJpbmcoMCwgMSkudG9VcHBlckNhc2UoKSArIHByb3BlcnR5TmFtZS5zdWJzdHJpbmcoMSk7XG5cbiAgY29uc3QgaGFzRGVmaW5pdGlvbnMgPSBuZXdDbGFzcy5wcm90b3R5cGVbJ19fYWRqdXN0JyArIGNhbWVsXSB8fCBuZXdDbGFzcy5wcm90b3R5cGVbJ19fdXBkYXRlJyArIGNhbWVsXSB8fFxuICAgIG5ld0NsYXNzLnByb3RvdHlwZVsnX19nZXQnICsgY2FtZWxdO1xuICBpZiAoaGFzRGVmaW5pdGlvbnMpIHtcbiAgICAvLyBzZXQgZGVmYXVsdCB2YWx1ZVxuICAgIG5ld0NsYXNzLnByb3RvdHlwZVtwS2V5XSA9IG5ld0NsYXNzLnByb3RvdHlwZVtwcm9wZXJ0eU5hbWVdO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld0NsYXNzLnByb3RvdHlwZSwgcHJvcGVydHlOYW1lLCB7XG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzWydfX2dldCcgKyBjYW1lbF0gPyB0aGlzWydfX2dldCcgKyBjYW1lbF0ocEtleSkgOiB0aGlzW3BLZXldO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24gc2V0KGluVmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICAgICAgY29uc3QgaW5pdGlhbCA9IHRoaXNbcEtleV07XG4gICAgICAgIGlmIChpblZhbHVlICE9PSBpbml0aWFsKSB7XG4gICAgICAgICAgaWYgKHRoaXNbJ19fYWRqdXN0JyArIGNhbWVsXSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpc1snX19hZGp1c3QnICsgY2FtZWxdKGluVmFsdWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSBpblZhbHVlID0gcmVzdWx0O1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzW3BLZXldID0gaW5WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5WYWx1ZSAhPT0gaW5pdGlhbCkge1xuICAgICAgICAgIGlmICghdGhpcy5pc0luaXRpYWxpemluZyAmJiB0aGlzWydfX3VwZGF0ZScgKyBjYW1lbF0pIHtcbiAgICAgICAgICAgIHRoaXNbJ19fdXBkYXRlJyArIGNhbWVsXShpblZhbHVlLCBpbml0aWFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5pdENsYXNzKG5ld0NsYXNzLCBjbGFzc05hbWUpIHtcbiAgLy8gTWFrZSBzdXJlIG91ciBuZXcgY2xhc3MgaGFzIGEgbmFtZSBwcm9wZXJ0eVxuICBpZiAoIW5ld0NsYXNzLm5hbWUpIG5ld0NsYXNzLm5hbWUgPSBjbGFzc05hbWU7XG5cbiAgLy8gTWFrZSBzdXJlIG91ciBuZXcgY2xhc3MgaGFzIGEgX3N1cHBvcnRlZEV2ZW50cywgX2lnbm9yZWRFdmVudHMsIF9pbk9iamVjdElnbm9yZSBhbmQgRVZFTlRTIHByb3BlcnRpZXNcbiAgaWYgKCFuZXdDbGFzcy5fc3VwcG9ydGVkRXZlbnRzKSBuZXdDbGFzcy5fc3VwcG9ydGVkRXZlbnRzID0gUm9vdC5fc3VwcG9ydGVkRXZlbnRzO1xuICBpZiAoIW5ld0NsYXNzLl9pZ25vcmVkRXZlbnRzKSBuZXdDbGFzcy5faWdub3JlZEV2ZW50cyA9IFJvb3QuX2lnbm9yZWRFdmVudHM7XG5cbiAgLy8gR2VuZXJhdGUgYSBsaXN0IG9mIHByb3BlcnRpZXMgZm9yIHRoaXMgY2xhc3M7IHdlIGRvbid0IGluY2x1ZGUgYW55XG4gIC8vIHByb3BlcnRpZXMgZnJvbSBsYXllci5Sb290XG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhuZXdDbGFzcy5wcm90b3R5cGUpLmZpbHRlcihrZXkgPT5cbiAgICBuZXdDbGFzcy5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJlxuICAgICFSb290LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmXG4gICAgdHlwZW9mIG5ld0NsYXNzLnByb3RvdHlwZVtrZXldICE9PSAnZnVuY3Rpb24nXG4gICk7XG5cbiAgLy8gRGVmaW5lIGdldHRlcnMvc2V0dGVycyBmb3IgYW55IHByb3BlcnR5IHRoYXQgaGFzIF9fYWRqdXN0IG9yIF9fdXBkYXRlIG1ldGhvZHMgZGVmaW5lZFxuICBrZXlzLmZvckVhY2gobmFtZSA9PiBkZWZpbmVQcm9wZXJ0eShuZXdDbGFzcywgbmFtZSkpO1xufVxuXG4vKipcbiAqIFNldCB0byB0cnVlIG9uY2UgZGVzdHJveSgpIGhhcyBiZWVuIGNhbGxlZC5cbiAqXG4gKiBBIGRlc3Ryb3llZCBvYmplY3Qgd2lsbCBsaWtlbHkgY2F1c2UgZXJyb3JzIGluIGFueSBhdHRlbXB0XG4gKiB0byBjYWxsIG1ldGhvZHMgb24gaXQsIGFuZCB3aWxsIG5vIGxvbmdlciB0cmlnZ2VyIGV2ZW50cy5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5Sb290LnByb3RvdHlwZS5pc0Rlc3Ryb3llZCA9IGZhbHNlO1xuXG4vKipcbiAqIEV2ZXJ5IGluc3RhbmNlIGhhcyBpdHMgb3duIGludGVybmFsIElELlxuICpcbiAqIFRoaXMgSUQgaXMgZGlzdGluY3QgZnJvbSBhbnkgSURzIGFzc2lnbmVkIGJ5IHRoZSBzZXJ2ZXIuXG4gKiBUaGUgaW50ZXJuYWwgSUQgaXMgZ2F1cmVudGVlZCBub3QgdG8gY2hhbmdlIHdpdGhpbiB0aGUgbGlmZXRpbWUgb2YgdGhlIE9iamVjdC9zZXNzaW9uO1xuICogaXQgaXMgcG9zc2libGUsIG9uIGNyZWF0aW5nIGEgbmV3IG9iamVjdCwgZm9yIGl0cyBgaWRgIHByb3BlcnR5IHRvIGNoYW5nZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblJvb3QucHJvdG90eXBlLmludGVybmFsSWQgPSAnJztcblxuLyoqXG4gKiBUcnVlIHdoaWxlIHdlIGFyZSBpbiB0aGUgY29uc3RydWN0b3IuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuUm9vdC5wcm90b3R5cGUuaXNJbml0aWFsaXppbmcgPSB0cnVlO1xuXG4vKipcbiAqIE9iamVjdHMgdGhhdCB0aGlzIG9iamVjdCBpcyBsaXN0ZW5pbmcgZm9yIGV2ZW50cyBmcm9tLlxuICpcbiAqIEB0eXBlIHtsYXllci5Sb290W119XG4gKiBAcHJpdmF0ZVxuICovXG5Sb290LnByb3RvdHlwZS5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMgPSBudWxsO1xuXG4vKipcbiAqIERpc2FibGUgYWxsIGV2ZW50cyB0cmlnZ2VyZWQgb24gdGhpcyBvYmplY3QuXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEBwcml2YXRlXG4gKi9cblJvb3QucHJvdG90eXBlLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG5cblxuUm9vdC5fc3VwcG9ydGVkRXZlbnRzID0gWydkZXN0cm95JywgJ2FsbCddO1xuUm9vdC5faWdub3JlZEV2ZW50cyA9IFtdO1xubW9kdWxlLmV4cG9ydHMgPSBSb290O1xubW9kdWxlLmV4cG9ydHMuaW5pdENsYXNzID0gaW5pdENsYXNzO1xuIl19
