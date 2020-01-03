/**
 * 根据字符串获取属性
 * @param {*} str 
 * @param {*} context 
 */

const expr = /(\w+)\[(\w+)\]/g;

export function getProp(str, context) {
    try {
        var props = str.split(".");
        var next = context || this,
            prop;
        var last = null;
        for (var i = 0; i < props.length; i++) {
            prop = props[i];
            if (next && prop) {
                if (expr.test(prop)) {
                    next = next[RegExp.$1];
                    last = next;
                    next = next[RegExp.$2];
                } else {
                    last = next;
                    next = next[prop];
                }
            }
        }
        if (typeof next == "function") {
            return next.bind(last);
        } else {
            return next;
        }
    } catch (e) {
        return null;
    }
}