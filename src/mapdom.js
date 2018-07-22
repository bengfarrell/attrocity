export default {
    /**
     * defaults
     * @returns {{attribute: string, root: string}}
     */
    get defaults() {
        return {
            attribute: 'cache',
            root: 'cacheroot'
        }
    },

    /**
     * generate attribute selector for query selection
     * @param name
     * @returns {string}
     */
    attributeSelector(name) { return '[' + name + ']'; },

    /**
     * map dom elements with desired attribute to object
     * @param node
     * @param opts
     */
    map(node, opts) {
        opts = Object.assign(this.defaults, opts ? opts : {} );
        const selector = this.attributeSelector(opts.attribute);

        let domcache = {};
        let els = node.querySelectorAll(selector);
        let rootlevelEls = node.querySelectorAll(this.attributeSelector(opts.root));

        let nondeepEls = [];
        // weed out selections past the desired root
        for (let e = 0; e < els.length; e++) {
            let elIsContainedByRoot = false;
            for (let d = 0; d < rootlevelEls.length; d++) {
                if (rootlevelEls[d] !== els[e] && rootlevelEls[d].contains(els[e])) {
                    elIsContainedByRoot = true;
                }
            }
            if (!elIsContainedByRoot) {
                nondeepEls.push(els[e]);
            }
        }

        // map to object
        for (let c = 0; c < nondeepEls.length; c++) {
            let props = nondeepEls[c].getAttribute(opts.attribute);
            let level = domcache;
            props = props.split('.');
            props = props.reverse();

            while (props.length > 0) {
                let prop = props.pop();

                if (!level[prop]) {
                    if (props.length === 0) {
                        level[prop] = nondeepEls[c];
                    } else {
                        level[prop] = {}
                    }
                }
                level = level[prop];
            }
        }
        return domcache;
    },
}