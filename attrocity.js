(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.attrocity = factory());
}(this, (function () { 'use strict';

    /**
     * Conversion between Objects, Elements, Attributes, and Strings
     */
    class Convert {
        /**
         * default ignore list for attributes
         * @returns {string[]}
         */
        static get ignore() { return [ 'class' ]; };

        /**
         * default settings for most methods in module
         * @returns {{allowAllAttributes: boolean, typeConvert: boolean, ignore: *}}
         */
        static get defaults() {
            return {
                allowAllAttributes: false,
                typeConvert: true,
                ignore: this.ignore
            }
        };

        /**
         * object from element attribtues
         * @param {Object} el element
         * @param {Object} opts options {
         *          allowAllAttributes: boolean to allow all attributes to come through, default false
         *          typeConvert: boolean to allow conversion of numbers from strings
         *          ignore: Array of attributes to ignore default [class]
         * @return object/dictionary
         */
        static fromAttrs(el, opts) {
            opts = Object.assign(this.defaults, opts ? opts : {} );
            const o = {};
            const attributes = el.attributes;
            for (let c = 0; c < attributes.length; c++) {
                if (opts.ignore.indexOf(attributes[c].nodeName) === -1 || opts.allowAllAttributes) {
                    let val = attributes[c].nodeValue;
                    if (!isNaN(parseFloat(val)) && opts.typeConvert) {
                        val = parseFloat(val);
                    }
                    o[attributes[c].nodeName] = val;
                }
            }
            return o;
        };

        /**
         * set attributes of an element sourced from an object
         * @param {Object} el element to accept object mapping
         * @param {Object} obj object to map to element
         * @param {Object} opts options {
         *          allowAllAttributes: boolean to allow all attributes to come through, default false
         *          typeConvert: boolean to allow conversion of numbers from strings
         *          ignore: Array of attributes to ignore default [class]
         * @returns {*} element
         */
        static setAttrs(el, obj, opts) {
            opts = Object.assign(this.defaults, opts ? opts : {} );
            if (obj instanceof Element) {
                obj = this.fromAttrs(obj, opts);
            }
            const keys = Object.keys(obj);
            for (let c = 0; c < keys.length; c++) {
                if (opts.ignore.indexOf(keys[c]) === -1 || opts.allowAllAttributes) {
                    if (typeof obj[keys[c]] === 'string' || typeof obj[keys[c]] === 'number') {
                        el.setAttribute(keys[c], obj[keys[c]]);
                    }
                }
            }
            return el;
        };

        /**
         * convert to string of attributes (myattr="value" anotherattr="value")
         * @param {Object} obj simple flat obj or element
         * @param {Object} opts options {
         *          allowAllAttributes: boolean to allow all attributes to come through, default false
         *          typeConvert: boolean to allow conversion of numbers from strings
         *          ignore: Array of attributes to ignore default [class]
         * @returns {string}
         */
        static toAttrString(obj, opts) {
            opts = Object.assign(this.defaults, opts ? opts : {} );

            if (obj instanceof Element) {
                obj = this.fromAttrs(obj, opts);
            }

            const keys = Object.keys(obj);
            let str = '';
            for (let c = 0; c < keys.length; c++) {
                if (opts.ignore.indexOf(keys[c]) === -1 || opts.allowAllAttributes) {
                    if (typeof obj[keys[c]] === 'string' || typeof obj[keys[c]] === 'number') {
                        str += keys[c] + '="' + obj[keys[c]] + '" ';
                    }
                }
            }
            return str.trimRight();
        }
    }

    class AbstractObservable {
        static get WATCH_ANY() { return 'watch-any'; }
        static get WATCH_CURRENT_ONLY() { return 'watch-current-only'; }

        /**
         * constructor
         * @param obj
         * @param {Function} cb
         */
        constructor(obj, cb, watchlist) {
            this._model = obj;
            this._id = Symbol();
            this._name = '';
            this._callbacks = new Map();
            this._allowAllKeys = false;

            if (cb) {
                this._primaryCallback = this.addCallback(cb);
            }

            if (Array.isArray(watchlist)) {
                this._keys = watchlist.slice();

            } else {
                switch(watchlist) {
                    case AbstractObservable.WATCH_ANY:
                        this._allowAllKeys = true;
                        break;

                    case AbstractObservable.WATCH_CURRENT_ONLY:
                        if (obj instanceof Element) {
                            let wl = Array.from(obj.attributes);
                            this._keys = wl.map( i => { return i.name });
                        } else {
                            this._keys = Object.keys(obj);
                        }
                        break;

                    default:
                        // default to watch any and all
                        this._allowAllKeys = true;
                        break;

                }
            }
        }

        /**
         * getter for isObservable to check if we inherit from this class
         * @returns {boolean}
         */
        get isObservable() { return true; }

        /**
         * stop observation
         */
        stop() {}

        /**
         * get ID
         * @returns {symbol | *}
         */
        get id() { return this._id; }

        /**
         * get name
         * @returns string
         */
        get name() { return this._name; }

        /**
         * set name
         * @param string
         */
        set name(val) { this._name = val; }

        /**
         * get data
         * @returns {*}
         */
        get data() { return this._model; }

        /**
         * get allowAllKeys bool
         * @returns {boolean}
         */
        get allowAllKeys() {
            return this._allowAllKeys;
        }

        /**
         * get keys
         * @returns {string[] | *}
         */
        get keys() {
            if (this._keys) {
                return this._keys;
            } else {
                return Object.keys(this._model);
            }
        }

        /**
         * add callback
         * @param cb
         * @param scope
         * @returns {symbol}
         */
        addCallback(cb, scope) {
            const id = Symbol();
            this._callbacks.set(id, { callback: cb, scope: scope });
            return id;
        }

        /**
         * remove callback
         * @param id
         */
        removeCallback(id) {
            if (!id) {
                id = this._primaryCallback;
            }
            this._callbacks.delete(id);
        }

        /**
         * dispatch change
         * @param obj
         * @param name
         * @param value
         * @param oldValue
         */
        dispatchChange(name, value, details) {
            if (value === details.oldValue) { return; }
            if (!details.originChain) { details.originChain = [details.scope]; }
            this._callbacks.forEach(cb => {
                if (details.originChain.indexOf(cb.scope) === -1) {
                    Binding.log({action: 'observablechange', target: cb.scope, source: details.scope, origin: details.originChain, key: name, value: value, old: details.oldValue });
                    cb.callback.apply(this, [name, value, { oldValue: details.oldValue, originChain: details.originChain, scope: details.scope }]);
                }
            });
        }

        _createProxy() {
            const scope = this;
            return new Proxy(this._rawdata, {
                get: function(target, name) {
                    return scope._getKey(name);
                },
                set: function(target, prop, value) {
                    scope._setKey(prop, value);
                    return true;

                }
            });
        }

        _keyAllowed(key) {
            return this.allowAllKeys || this.keys.indexOf(key) !== -1;
        }

        _setRawValue(key, value) {
            this._rawdata[key] = value;
        }

        _getRawValue(key) {
            return this._rawdata[key];
        }

        _getKey(prop) {
            if (this._keyAllowed(prop)) {
                Binding.log({action: 'getvalue', key: prop, source: this });
                return this._getRawValue(prop);
            } else {
                return undefined;
            }
        }

        _setKey(prop, value, originchain) {
            if (!originchain) { originchain = []; }
            originchain.push(this);

            if (this._keyAllowed(prop)) {
                const oldvalue = this._getRawValue(prop);
                this._setRawValue(prop, value);

                Binding.log({action: 'setvalue', key: prop, target: this, origin: originchain });

                if (this._observing) {
                    this.dispatchChange(prop, value, { oldValue: oldvalue, originChain: originchain, scope: this });
                }
            }
        }
    }

    class Binding {
        static get PUSH() { return 'push'; }
        static get PULL() { return 'pull'; }
        static get TWOWAY() { return 'twoway'; }

        /**
         * constructor
         */
        constructor(cb) {
            this._destinations = new Map();
            this._sources = new Map();
            this._namedCallbacks = {};
            this._aggregateValues = {};
            this._callbacks = [];
            this._name = '';

            if (cb) {
                this.addCallback(cb);
            }
        }

        get name() {
            return this._name;
        }

        set name(val) {
            this._name = val;
        }

        addCallback(cb, name) {
            if (!name) {
                this._callbacks.push({ callback: cb  });
            } else {
                if (!Array.isArray(name)) {
                    name = [name];
                }

                for (let c = 0; c < name.length; c++) {
                    if (!this._namedCallbacks[name[c]]) {
                        this._namedCallbacks[name[c]] = [];
                    }
                    this._namedCallbacks[name[c]].push({ callback: cb });
                }
            }
        }

        /**
         * add binding
         * @param {AbstractObservable} obj
         * @param {String} direction binding direction
         */
        add(obj, direction) {
            direction = direction ? direction : Binding.TWOWAY;
            this._name += '|' + obj.name + '@' + direction + '|';
            if (obj.isObservable === false) {
                console.error('Adding binding for non-observable object', obj);
                return;
            }

            Binding.log({action: 'add', target: obj });

            if (!direction || direction === Binding.PUSH || direction === Binding.TWOWAY) {
                const cbID = obj.addCallback((key, value, details) =>
                        this._onDataChange(key, value, { oldValue: details.oldValue, originChain: details.originChain, scope: details.scope }), this);
                this._sources.set(obj.id, { observable: obj, callback: cbID });
            }
            if (!direction || direction === Binding.PULL || direction === Binding.TWOWAY) {
                this._destinations.set(obj.id, { observable: obj });
            }
        }

        /**
         * sync current values and add binding
         * @param {AbstractObservable} obj
         * @param {String} direction binding direction
         */
        sync(obj, direction) {
            this.add(obj, direction);
            if (!direction || direction === Binding.PUSH || direction === Binding.TWOWAY) {
                this.pushAllValues(obj);
            }

            if (!direction || direction === Binding.PULL || direction === Binding.TWOWAY) {
                this.pullAllValues(obj);
            }

        }

        pushAllValues(src) {
            for (let c = 0; c < src.keys.length; c++) {
                if (src.data[src.keys[c]] !== undefined) {
                    this._onDataChange(src.keys[c], src.data[src.keys[c]], { scope: src });
                }
            }
        }

        pullAllValues(dest) {
            for (let c in this._aggregateValues) {
                if (this._aggregateValues[c] !== undefined) {
                    Binding.log({action: 'pull', target: dest, source: this });
                    dest.data[c] = this._aggregateValues[c];
                }
            }
        }

        /**
         * remove binding for object
         * @param {AbstractObservable} obj
         */
        remove(obj) {
            const src = this._sources.get(obj.id);
            src.observable.removeCallback(src.callback);
            this._destinations.delete(obj.id);
            this._sources.delete(obj.id);
        }

        /**
         * on data changed from source
         * @param {AbstractObservable} obj
         * @param {String} key name of changed attribute
         * @param value value of changed attribute
         * @private
         */
        _onDataChange(key, value, details) {
            if (!details.originChain) { details.originChain = []; }
            details.originChain.push(this);

            this._aggregateValues[key] = value;
            for (const dest of this._destinations.entries()){
                if (details.scope.id !== dest[1].observable.id && details.originChain.indexOf(dest[1].observable) === -1) {
                    Binding.log({action: 'push', source: this, target: dest[1].observable, origin: details.originChain });
                    dest[1].observable._setKey(key, value, details.originChain);
                }
            }

            for (let c = 0; c < this._callbacks.length; c++) {
                if (!this._callbacks[c].scope || details.originChain.indexOf(this._callbacks[c].scope) === -1) {
                    Binding.log({action: 'bindingchange', source: details.scope, target: this._callbacks[c].scope, origin: details.originChain });
                    this._callbacks[c].callback.apply(this, [key, value, { oldValue: details.oldValue, originChain: details.originChain, scope: details.scope }]);
                }
            }

            if (this._namedCallbacks[key]) {
                for (let c = 0; c < this._namedCallbacks[key].length; c++) {
                    if (!this._namedCallbacks[key][c].scope || details.originChain.indexOf(this._namedCallbacks[key][c].scope) === -1) {
                        Binding.log({action: 'bindingchange', source: this, target: this._namedCallbacks[key][c].scope, origin: details.originChain });
                        this._namedCallbacks[key][c].callback.apply(this, [key, value, { oldValue: details.oldValue, originChain: details.originChain, scope: details.scope }]);
                    }
                }

            }
        }

        static log(o) {
            if (Binding.debugMode || this.debugMode) {
                console.log('----------');
                console.log('* ' + o.action);

                let src, dest;
                if (o.source) { src = o.source.name; }
                if (o.target) { dest = o.target.name; }
                if (src === undefined) { src = ''; }
                if (dest === undefined) { dest = ''; }
                if (src || dest) {
                    console.log(src + ' -> ' + dest);
                }

                if (o.origin && o.origin.length > 0) {
                    console.log('origins:', o.origin.map( i => { return i.name } ).join(','));
                }

                if (o.key) {        console.log( ' - key -       :', o.key );}
                if (o.value) {      console.log( ' - value -     :', o.value );}
                if (o.oldValue) {   console.log( ' - old value - :', o.value );}
            }
        }

    }

    class MapDOM {
        /**
         * defaults
         * @returns {{attribute: string, root: string}}
         */
        static get mapdefaults() {
            return {
                attribute: 'map',
                root: 'maproot'
            }
        };

        /**
         * defaults
         * @returns {{attribute: string, root: string}}
         */
        static get wiredefaults() {
            return {
                attribute: 'wire',
                root: 'maproot'
            }
        };

        /**
         * generate attribute selector for query selection
         * @param name
         * @returns {string}
         */
        static _attributeSelector(name) { return '[' + name + ']'; };

        /**
         * map dom elements with desired attribute to object
         * @param node
         * @param startingObj
         * @param opts
         */
        static map(node, startingObj, opts) {
            opts = Object.assign(this.mapdefaults, opts ? opts : {} );
            const selector = this._attributeSelector(opts.attribute);

            let domcache = startingObj ? startingObj : {};
            let els = node.querySelectorAll(selector);
            let rootlevelEls = node.querySelectorAll(this._attributeSelector(opts.root));

            els = this._filterElementsContainedByRoot(els, rootlevelEls);

            for (let e = 0; e < els.length; e++) {
                let path = els[e].getAttribute(opts.attribute).split('.');
                const prop = path.pop();
                const deepref = this._ensurePropertyPath(domcache, path);
                this._setProperty(deepref, prop, els[e]);

            }
            return domcache;
        };

        static wire(node, callback, scope, opts) {
            opts = Object.assign(this.wiredefaults, opts ? opts : {} );
            const selector = this._attributeSelector(opts.attribute);
            let els = node.querySelectorAll(selector);
            let rootlevelEls = node.querySelectorAll(this._attributeSelector(opts.root));

            els = this._filterElementsContainedByRoot(els, rootlevelEls);
            for (let e = 0; e < els.length; e++) {
                const eventtypes = els[e].getAttribute(opts.attribute).split(',');
                for (let c = 0; c < eventtypes.length; c++) {
                    els[e].addEventListener(eventtypes[c], e => { callback.apply(scope, [e]); });
                }
            }
        }

        static wireElements(els, events, callback, scope) {
            if (!Array.isArray(els)) {
                els =  [els];
            }
            let eventtypes = events;
            if (!Array.isArray(events)) {
                eventtypes = eventtypes.split(',');
            }
            for (let d = 0; d < els.length; d++) {
                for (let c = 0; c < eventtypes.length; c++) {
                    els[d].addEventListener(eventtypes[c].trim(), e => { callback.apply(scope, [e]); });
                }
            }
        }

        /**
         * ensure deep or shallow path exists on object
         * @param obj
         * @param propslist
         * @return deep reference
         */
        static _ensurePropertyPath(obj, propslist) {
            propslist = propslist.reverse();
            let parent;
            let parentProp;
            while (propslist.length > 0) {
                const prop = propslist.pop();
                if (!obj[prop]) {
                    obj[prop] = {};
                }
                parent = obj;
                obj = obj[prop];
                parentProp = prop;
            }
            return { current: obj, parent: parent, parentProp: parentProp };
        }

        /**
         * set property on object
         * @param obj
         * @param prop
         * @param val
         * @private
         */
        static _setProperty(obj, prop, val) {
            let ref = obj.current;
            let parent = obj.parent;
            let parentProp = obj.parentProp;
            if (!ref[prop]) {
                // element already set on prop, but we're adding more key/values to it as an object
                // roll back to parent and set object that can hold all
                if (ref instanceof Element) {
                    parent[parentProp] = {};
                    parent[parentProp][parentProp] = ref;
                    parent[parentProp][prop] = val;
                } else {
                    ref[prop] = val;
                }
            } else if (ref[prop] instanceof Element) {
                // element already exists on key, turn into array holding list
                ref[prop] = [ ref[prop] ];
                ref[prop].push(val);
            } else if (Array.isArray(ref[prop])) {
                ref[prop].push(val);
            } else if (Object.keys(ref[prop]).length > 0) {
                // key being set is already an object containing keys, bump this key further down the chain
                ref[prop][prop] = val;
            }
        }

        /**
         * remove elements contained by marked roots
         * @param els
         * @param roots
         * @returns {Array}
         */
        static _filterElementsContainedByRoot(els, roots) {
            const nondeepEls = [];
            for (let e = 0; e < els.length; e++) {
                let elIsContainedByRoot = false;
                for (let d = 0; d < roots.length; d++) {
                    if (roots[d] !== els[e] && roots[d].contains(els[e])) {
                        elIsContainedByRoot = true;
                    }
                }
                if (!elIsContainedByRoot) {
                    nondeepEls.push(els[e]);
                }
            }
            return nondeepEls;
        }
    }

    class CastingRules {
        static defaultRule(value) {
            if (value === 'true') { return true; }
            if (value === 'false') { return false; }
            if (typeof value === 'boolean') { return value; }
            if (!isNaN(Number(value))) { return Number(value); }
            return value;
        }

        constructor() {
            this._rules = new Map();
            this._rules.set('*', [ CastingRules.defaultRule ]);

        }

        addRule(key, rule) {
            if (key === '*') {
                this._rules.get(key).push(rule);
            } else if (Array.isArray(key)) {
                for (let c = 0; c < key.length; c++) {
                    this.addRule(key[c], rule );
                }
            } else {
                this._rules.set(key, rule);
            }
        }

        cast(key, value) {
            let val = value;
            const genericRules = this._rules.get('*');
            for (let c = 0; c < genericRules.length; c++) {
                val = genericRules[c](val);
            }

            if (this._rules.has(key)) {
                return this._rules.get(key)(val);
            } else {
                return val;
            }
        }

    }

    class ObservableElement extends AbstractObservable {
        /**
         * constructor
         * @param {HTMLElement} el element to watch
         * @param {Function} cb callback
         * @param {Array} watchlist list of attributes to watch on element (if null, watch them all)
         */
        constructor(el, cb, watchlist) {
            super(el, cb, watchlist);
            this.observer = new MutationObserver(e => this.onMutationChange(e));
            this.observer.observe(el, { attributes: true, attributeOldValue: true });

            this._rawdata = el;
            this.name = el.tagName;

            this._model = this._createProxy();
        }

        _setRawValue(key, value) {
            this._rawdata.setAttribute(key, value);
        }

        _getRawValue(key) {
            if (this._rawdata.getAttribute(key)) {
                return this._rawdata.getAttribute(key);
            } else {
                return undefined;
            }
        }

        /**
         * stop observation
         */
        stop() {
            this.observer.disconnect();
        }

        /**
         * mutation change handler
         * @param e
         */
        onMutationChange(e) {
            for (let c = 0; c < e.length; c++) {
                if (this.keys.length === 0 || this.keys.indexOf(e[c].attributeName) !== -1) {
                    this.dispatchChange(
                        e[c].attributeName,
                        e[c].target.getAttribute(e[c].attributeName),
                        { oldValue: e[c].oldValue, originChain: [this], scope: e[c].target });
                }
            }
        }
    }

    class ObservableObject extends AbstractObservable {
        /**
         * constructor
         * @param {Object} object to watch
         * @param {Function} cb callback
         * @param {Array | String} watchlist list of attributes to watch on element (if null, watch them all)
         */
        constructor(obj, cb, watchlist, name) {
            super(obj, cb, watchlist);
            if (name) { this._name = name; }
            this._rawdata = obj;
            this._model = this._createProxy();
            this._observing = true;
        }

        /**
         * stop observation
         */
        stop() {
            this._observing = false;
        }

        /**
         * get data
         * @returns {*}
         */
        get data() {
            return this._model;
        }
    }

    class CustomElementBindingManager {
        constructor() {
            this._observables = {};
            this._binding = new Binding();
            this._rules = new CastingRules();
            this._name = ['CustomElementBindingManager'];
        }

        get binding() {
            return this._binding;
        }

        get castingRules() {
            return this._rules;
        }

        get name() {
            return this._name.join('*');
        }

        addRule(key, rule) {
            this._rules.addRule(key, rule);
        }

        addCallback(cb, name) {
            if (!name) {
                this.binding.addCallback((name, value, details) => {
                    if (!details.originChain) {
                        details.originChain = [];
                    }
                    details.originChain.push(this);
                    cb(name, this._rules.cast(name, value), { oldValue: details.oldvalue, originChain: details.originChain, scope: details.scope });
                });
            } else {
                this.binding.addCallback((name, value, details) => {
                    if (!details.originChain) {
                        details.originChain = [];
                    }
                    details.originChain.push(this);
                    cb(name, this._rules.cast(name, value), { oldValue: details.oldvalue, originChain: details.originChain, scope: details.scope });
                }, name);
            }
        }

        add(observable, bindingdirection, name) {
            if (!name) {
                name = observable.constructor.name;
            }
            this._observables[name] = observable;
            this._binding.add(observable, bindingdirection);
            this._name.push(observable.name);
            return this._binding;
        }

        sync(observable, bindingdirection, name) {
            if (!name) {
                name = observable.constructor.name;
            }
            this._observables[name] = observable;
            this._binding.sync(observable, bindingdirection);
            this._name.push(observable.name);
            return this._binding;
        }

        getObservable(name) {
            return this._observables[name];
        }
    }

    class ObservableCustomElement extends AbstractObservable {
        /**
         * attach class to web component as a mixin
         * @param clazz
         * @returns {*}
         */
        static attach(clazz) {
            clazz.prototype.attributeChangedCallback = function (name, oldValue, newValue) {
                if (this.__attrocity) {
                    let originchain = [];
                    if (this.__attrocity.originChainContinuity) {
                        originchain = this.__attrocity.originChainContinuity;
                    }
                    this.__attrocity.originChainContinuity = [];
                    if (!this.__attrocity.getObservable('customelement')._observing ) { return; }
                    const ce = this.__attrocity.getObservable('customelement');
                    ce.dispatchChange(name, newValue, { oldValue: oldValue, originChain: originchain, scope: ce });
                }
            };
            return clazz;
        }

        /**
         * create bindings on instance
         * @param scope
         * @param opts
         * @returns {CustomElementBindingManager}
         */
        static createBindings(scope, opts) {
            scope.__attrocity = new CustomElementBindingManager();
            scope.__attrocity.sync(new ObservableCustomElement(scope,
                (name, val, { oldValue: old, originChain: originchain, scope: o }) => { scope.__attrocity.originChainContinuity = originchain; },
                scope.constructor.observedAttributes),
                Binding.TWOWAY, 'customelement');
            return scope.__attrocity;
        }


        /**
         * constructor
         * @param {HTMLElement} el element to watch
         * @param {Function} cb callback
         */
        constructor(el, cb) {
            super(el, cb, el.constructor.observedAttributes);

            this._observing = true;

            this._rawdata = el;
            this.name = el.tagName;
            this._model = this._createProxy();

        }

        _setRawValue(key, value) {
            this._rawdata.setAttribute(key, value);
        }

        _getRawValue(key) {
            if (this._rawdata.getAttribute(key)) {
                return this._rawdata.getAttribute(key);
            } else {
                return undefined;
            }
        }

        _setKey(prop, value, originchain) {
            if (!originchain) { originchain = []; }
            originchain.push(this);

            if (this._keyAllowed(prop)) {
                const oldvalue = this._getRawValue(prop);
                this._setRawValue(prop, value);

                Binding.log({action: 'setvalue', key: prop, target: this, origin: originchain });
            }
        }

        /**
         * stop observation
         */
        stop() {
            this._observing = false;
        }
    }

    class Main {
        /**
         * Bind
         * @returns {Convert}
         * @constructor
         */
        static get Bind() { return Binding; }

        /**
         * Convert
         * @returns {Convert}
         * @constructor
         */
        static get Convert() { return Convert; }

        /**
         * MapDOM
         * @returns {MapDOM}
         * @constructor
         */
        static get MapDOM() { return MapDOM; }

        /**
         * Casting
         * @returns {CastingRules}
         * @constructor
         */
        static get CastingRules() { return CastingRules; }

        /**
         * Observables
         * @returns {{Element: ObservableElement, Object: ObservableObject}}
         * @constructor
         */
        static get Observables() {
            return {
                Element: ObservableElement,
                CustomElement: ObservableCustomElement,
                Object: ObservableObject
            }
        }
    }

    return Main;

})));
//# sourceMappingURL=attrocity.js.map
