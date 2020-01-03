/**
 * get请求
 * @param  {string}   url      请求地址
 * @param  {string}   params   请求参数
 * @param  {Function} callback 返回请求结果
 * @param  {Function} error    返回错误
 */
export function get(url, callback, async, token) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, async === false ? false : true);
    if(token && token.key && token.value){
        xhr.setRequestHeader(token.key, token.value);
    }
    /*xhr.setRequestHeader("Security-Policy","xxxx");*/
    //xhr.withCredentials = true;
    xhr.onabort = function (event) {
        callback(true, null);
    };
    xhr.onload = function (event) {
        if (!xhr.status || xhr.status >= 200 && xhr.status < 300) {
            var source;
            source = xhr.response;
            if (source) {
                try {
                    source = eval("(" + source + ")");
                } catch (e) {
                }
            }
            if (source) {
                /*if(source.length > 0){
                  debugger;
                }*/
                callback(false, source);
            } else {
                callback(false, null);
            }
        }
    };
    xhr.onerror = function (e) {
        callback(true, null);
    };
    xhr.send(null);
    return xhr;
}