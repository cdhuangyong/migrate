/*
 * @Author: hy
 * @Date: 2019-08-24 15:49:43
 * @LastEditTime: 2019-09-06 09:20:20
 * @Company: 成都四方伟业软件股份有限公司
 * @Description: 
 */
import mapboxgl from 'mapbox-gl'

import {get} from '../utils/get.js'

import {parseCSSColor} from './parseCSSColor.js'

import {getProp} from '../utils/getProp.js'

/**
 * 遍历线的点
 * @param  {array} coordinates 坐标
 * @param  {array} callBack    回调
 */
function forEachLineString(coordinates,callBack){
	var i;
	callBack(coordinates);
}
/**
 * 遍历多线的点
 * @param  {array} coordinates 坐标
 * @param  {array} callBack    回调
 */
function forEachMultiLineString(coordinates,callBack){
	var i,j,coord;
	for (i = 0; i < coordinates.length; i++) {
		coord = coordinates[i];
		callBack(coord);
	}
}
/**
 * 遍历面的点
 * @param  {array} coordinates 坐标
 * @param  {array} callBack    回调
 */
function forEachPolygon(coordinates,callBack){
	var i,j,coord;
	for (i = 0; i < coordinates.length; i++) {
		coord = coordinates[i];
		callBack(coord);
	}
}
/**
 * 遍历多面的点
 * @param  {array} coordinates 坐标
 * @param  {array} callBack    回调
 */
function forEachMultiPolygon(coordinates,callBack){
	var i,j,k,coord,coord1;
	for (i = 0; i < coordinates.length; i++) {
	 	coord = coordinates[i];
		for (j = 0; j < coord.length; j++) {
			coord1 = coord[j]
			callBack(coord1);
		}
	}
}
/**
 * canvas图层绘制
 * @type {Object}
 */
const graphic = {
	//圆形
	circle:function (context,radius,width,height) {
		context.fillStyle = "white";
		var x = width / 2, y = height / 2 ;
		context.arc(x , y, radius,0,Math.PI * 2);
		context.fill();
	},
	//箭头
	arrow:function (context,radius,width,height) {
		context.strokeStyle = "white";
		context.lineWidth = 5;
		context.beginPath();
		context.moveTo( 0 , height );
		context.lineTo( width / 2, 0 );
		context.lineTo( width , height);
		context.stroke();	
	},
	//空
	"none":function(context,radius){

	}
} 
//顶点着色器
var vertexShaderSource = `
	attribute vec4 a_Color;
	attribute float a_Radius;
	attribute vec2 a_Position;
	attribute float a_Angle;
	attribute float a_PointType;
	uniform mat4 u_matrix;
	varying vec4 v_Color;
	varying vec2 v_Position;
	varying float v_Angle;
	varying float v_PointType;
	void main (){
		gl_Position = u_matrix * vec4(a_Position,0.0,1.0);
		gl_PointSize = a_Radius;
		v_Color = a_Color;
		v_Position = a_Position;
		v_Angle = a_Angle;
		v_PointType = a_PointType;
	}
`;
//片元着色器
var fragmentShaderSource = `

	#ifdef GL_ES
	precision mediump float;
  	#endif
  	uniform sampler2D texture_head;
  	uniform sampler2D texture_tail;
  	uniform float bearing;
	varying vec4 v_Color;
	varying vec2 v_Position;
	varying float v_Angle;
	varying float v_PointType;

	void imageStyle(){

		vec2 coord = vec2(gl_PointCoord.x - 0.5,gl_PointCoord.y - 0.5);
		float angle = v_Angle -	 bearing;
		mat2 matrixRotate = mat2(cos(angle), sin(angle), - sin(angle), cos(angle));
		vec2 ncoord =  matrixRotate * coord;
		
		vec4 textureColor;
		if(v_PointType == 0.0){
			textureColor = texture2D(texture_head,vec2( ncoord.x + 0.5, ncoord.y + 0.5 ));
		}else{
			textureColor = texture2D(texture_tail,vec2( ncoord.x + 0.5, ncoord.y + 0.5 ));
			textureColor.rgb = v_Color.rgb;
		}

		float dis = distance(gl_PointCoord,vec2(0.5, 0.5));
		if(dis > 0.5){
			textureColor.a = 0.0;
		}
		textureColor.a *= v_Color.a;
		gl_FragColor = textureColor;
	}

	void main(){
		imageStyle();
	}
`;

/**
 * 线条实例
 * 处理线条的包围矩形，长度，分段等
 */
class Line {
	constructor(points){
		this.length = 0;
		this.lenLngLat = 0;
		this.points = points;
		this.segments = [];
		var bounds = this.bounds = [0,0,0,0];
		var point,mctPoint,i,seg = null;
		for(i = 0 ; i < points.length ; i ++){
			mctPoint = mapboxgl.MercatorCoordinate.fromLngLat(points[i]);
			point = [mctPoint.x,mctPoint.y];

			//计算线的extent范围
			if(i == 0){
				bounds[0] = point[0];
				bounds[1] = point[1];
				bounds[2] = point[0];
				bounds[3] = point[1];
			}else{
				if( bounds[0] > point[0]){
					bounds[0] = point[0];
				}
				if( bounds[2] < point[0]){
					bounds[2] = point[0];
				}
				if( bounds[1] < point[1] ){
					bounds[1] = point[1];
				}
				if( bounds[3] > point[1] ){
					bounds[3] = point[1];
				}
			}
			if(seg){
				seg.to = point;
				seg.toLngLat = points[i];
				seg.length = Math.sqrt( 
					Math.pow( seg.to[1] - seg.from[1] ,2 ) + 
					Math.pow( seg.to[0] - seg.from[0] ,2) 
				);
				seg.lenLngLat = Math.sqrt( 
					Math.pow( seg.toLngLat[1] - seg.fromLngLat[1] ,2 ) + 
					Math.pow( seg.toLngLat[0] - seg.fromLngLat[0] ,2) 
				);
				this.length += seg.length;
				this.lenLngLat += seg.lenLngLat;
				this.segments.push(seg);
			}
			seg = {
				length: 0,
				lenLngLat: 0,
				from:point,
				fromLngLat:points[i],
				to:null,
				toLngLat:null
			}
		}
	}
	/**
	 * 通过线性插值的方式去取在线条上的某个点
	 * @param  {number} t     比例
	 * @param  {array} point  用于存储点位置
	 * @return {array}        返回点位置
	 */
	getPointAt(t,point){
		t = t > 1 ? 1 : t < 0 ? 0 : t ;
		var length = this.getLength();
		var len0 = length * t;
		var sum = 0,i,seg;
		for(i = 0 ; i < this.segments.length; i ++ ){
			seg = this.segments[i];
			if(len0 <= ( sum + seg.length )){
				t = ( len0 - sum ) / seg.length;
				point[0] = seg.from[0] + t * (seg.to[0] - seg.from[0]);
				point[1] = seg.from[1] + t * (seg.to[1] - seg.from[1]);
				break;
			}
			sum += seg.length;
		}
		return point;
	}
	/**
	 * 获取线条长度
	 * @return {number} 线条长度
	 */
	getLength(){
		return this.length;
	}
}
/**
 * 用于管理webglbuffer的类
 */
class ArrayBufferData{
	constructor(options){
		var _this = this;
		this.buffer = new Float32Array();
		this.glBuffer = null;
		this.location = null;
		this.len = options.length;
		this.name = options.name;
		//指针
		var pointer = 0;
		Object.defineProperty(this, "length",{
			get:function(){
				return pointer;
			},
			set:function(val){
				pointer = val;
			}
		});
	}
	/**
	 * 初始化buffer
	 * @param  {object} gl      webgl对象
	 * @param  {object} program webgl程序对象
	 */
	init(gl,program){
		this.location = gl.getAttribLocation(program, this.name);	 
		this.glBuffer = gl.createBuffer();
	}
	/**
	 * 获取webgl buffer
	 * @return {object} webgl buffer
	 */
	getGlBuffer(){
		return this.glBuffer;
	}
	/**
	 * 获取类型化数组
	 * @return {arraybuffer} 类型化数据
	 */
	getBuffer(){
		return this.buffer
	}
	/** 
	 * 添加数据
	 * @param  {number} x 第一分量
	 * @param  {number} y 第二分量
	 * @param  {number} z 第三分量
	 * @param  {number} w 第四分量
	 */
	push(x,y,z,w){
		var len = this.len;
		if(this.buffer.length < this.length + this.len ){
			this.updateBufferLength();
		}
		switch(len){
			case 1 :
				this.length += 1;
				//this.position.push(x);
				this.buffer[this.length - 1] = x;
				break;
			case 2 : 
				this.length += 1;
				this.buffer[this.length - 1] = x;
				this.length += 1;
				this.buffer[this.length - 1] = y;
				break;
			case 3 : 
				this.length += 1;
				this.buffer[this.length - 1] = x;
				this.length += 1;
				this.buffer[this.length - 1] = y;
				this.length += 1;
				this.buffer[this.length - 1] = z;
				break;
			case 4 : 
				this.length += 1;
				this.buffer[this.length - 1] = x;
				this.length += 1;
				this.buffer[this.length - 1] = y;
				this.length += 1;
				this.buffer[this.length - 1] = z;
				this.length += 1;
				this.buffer[this.length - 1] = w;
				break;
		}
	}
	/**
	 * 更新buffer的长度
	 */
	updateBufferLength(){
		this.buffer = new Float32Array(this.buffer.length + 10000 * this.len);
	}
	/**
	 * 清除buffer
	 */
	clear(){
		this.buffer = null;
		this.glBuffer = null;
	}
}


/**
 * 动画粒子类
 * 管理粒子动画
 */
class Particle { 
	constructor(options = {}){
		this.point = [];
		this.line = options.line;
		var duration = options.style.duration;
		var delay = duration / 15;
		if(delay > 200){
			delay = 200;
		}
		this.time = performance.now() + delay * options.index;
		this.style = options.style;
		this.buffers = options.buffers;
	}
	//判断点是否在可视区内
	isInViewBounds(coord,extent){
		return coord[0] >= extent[0].x && coord[0] <= extent[1].x
		       && coord[1] >= extent[1].y && coord[1] <= extent[0].y;
	}
	//判断线是否再可视区域类
	isLineInViewBounds(extent){
		var lineBounds = this.line.bounds;
		if( lineBounds[0] > extent[1].x )return false;
		if( lineBounds[1] < extent[1].y )return false;
		if( lineBounds[2] < extent[0].x )return false;
		if( lineBounds[3] > extent[0].y )return false;
		return true;
	}
	reset(time){
		this.time = time;
	}
	//过渡动画
	stepDuration(time,resolution,extent){
		if(!this.isLineInViewBounds(extent)){
			return;
		}
		var style = this.style;
		var r = style.tail.color[0],
			g = style.tail.color[1],
			b = style.tail.color[2],
			a = style.tail.color[3];
		var headSize = style.header.size;
		var tailSize = style.tail.size;
		var opacity = style.header.opacity;
		var repeat = style.repeat;

		var tailRatio = style.tail.length;
		var duration = style.duration ;
		
		if(!this.time){
			this.time = time;
		}
		var dtime = time - this.time;

		if(dtime < 0){
			return;
		}

		var t = dtime / duration;

		if(t > (1 + tailRatio)){
			if(repeat){
				t = tailRatio;
				this.time = time - tailRatio * duration;
			}else{
				t = 0;
				this.time = Infinity;
				return;
			}
		}

		//尾迹长度
		var tailLen = this.line.lenLngLat * tailRatio;
		var particleLength = Math.ceil( tailLen / resolution / (tailSize) );
		var fx,fy,tx,ty;
		var t1;

		var len = this.line.lenLngLat * t;
		for(var i = 0 ; i < particleLength; i ++ ){
			len -= ( tailSize ) * resolution;
			t1 = len / this.line.lenLngLat;
		 	t1 = repeat && t1 > 1 ? t1 - 1 : t1;
			this.line.getPointAt( t1 ,this.point);
			if(this.isInViewBounds(this.point,extent)){
				this.buffers.position.push( this.point[0],this.point[1] );
				this.buffers.colors.push( r / 255, g / 255, b / 255,( t1 > 1 ? 0 : (1- (i+1) / particleLength) ) * a );
				this.buffers.radius.push( tailSize );
				this.buffers.pointTypes.push (1);
				fx = this.point[0];
				fy = this.point[1];
				this.line.getPointAt ( t1 + 0.00001, this.point );
				tx = this.point[0];
				ty = this.point[1];
				this.buffers.angles.push(
					-Math.atan2( ty - fy, tx - fx ) - Math.PI / 2
				);
			}
		}

		t1 = repeat && t > 1 ? t - 1 : t;
		this.line.getPointAt ( t1, this.point );
		if(this.isInViewBounds(this.point,extent) && t1 >=0 && t1 <= 1){
			this.buffers.position.push( this.point[0], this.point[1] );
			this.buffers.colors.push( r / 255, g / 255, b / 255, 1 * opacity );
			this.buffers.radius.push( headSize );
			this.buffers.pointTypes.push (0);
			fx = this.point[0];
			fy = this.point[1];
			this.line.getPointAt ( t1 + 0.00001, this.point );
			tx = this.point[0];
			ty = this.point[1];
			this.buffers.angles.push(
				-Math.atan2( ty - fy, tx - fx ) - Math.PI / 2
			);
		}
	}
	//匀速运动
	stepSpeed(resolution,extent){

		if(!this.isLineInViewBounds(extent)){
			return;
		}

		var plen = 1;
		var per = resolution * this.speed;
		var len = this.len,len1,i,j,t;
		var r = this.color[0],g = this.color[1],b = this.color[2],a = this.color[3],

		size = this.radius * 2 ;
		if(this.radius == 0) return;

		//每个粒子对应的圆个数 60是尾部长度
		//
		var tailLen = this.maxLen;

		var perNum = Math.ceil( tailLen / resolution / this.radius );

		var fx,fy,tx,ty;

		for (j = 0; j < plen; j++ ) {
			//len -= dis;
			if(len < 0){
				len = this.maxLen + len;
			}
			t = len / this.maxLen;
			this.line.getPointAt ( t, this.point );
			if(this.isInViewBounds(this.point,extent)){
				this.buffers.position.push( this.point[0], this.point[1] );
				this.buffers.colors.push(r / 255, g / 255, b / 255, a);
				this.buffers.radius.push( size );
				fx = this.point[0];
				fy = this.point[1];
				this.line.getPointAt ( t + 0.00001, this.point );
				tx = this.point[0];
				ty = this.point[1];
				this.buffers.angles.push(
					-Math.atan2( ty - fy, tx - fx ) - Math.PI / 2
				);
			}
			len1 = len;
			for(i = 0 ; i < perNum; i++ ){
				len1 -= ( this.radius /*- this.radius / 4*/) * resolution;
				this.line.getPointAt( len1 / this.maxLen  ,this.point);
				if(this.isInViewBounds(this.point,extent)){
					this.buffers.position.push( this.point[0],this.point[1] );
					this.buffers.colors.push( r / 255, g / 255, b / 255, 1- (i+1) / perNum );
					this.buffers.radius.push( size );
				}
			}
		}
		this.len += per;
		if( this.len > ( this.maxLen +  tailLen ) ){
			this.len = 0;
		}
	}
}

/**
 * 动态轨迹webgl实现
 */
export class MigrateGL {

	constructor(options){

		var _this = this;

		this.gl = options.gl;

		this.mbxmap = options.mbxmap;
		this.map = options.map;

		this.maxzoom = 22;
		this.minzoom = 0;
		this.zoom = this.mbxmap.getZoom();
		this.visible = options.visible;


		this.changed = false;
		this.init = false;
		//线条
		this.lines = [];
		//粒子
		this.particles = [];

		this.buffers = {
			//位置
			position:  new ArrayBufferData({
				length:2,
				name:"a_Position"
			}),
			//颜色
			colors: new ArrayBufferData({
				length:4,
				name:"a_Color"
			}),
			//半径
			radius: new ArrayBufferData({
				length:1,
				name:"a_Radius"
			}),
			//旋转角度
			angles: new ArrayBufferData({
				length:1,
				name:"a_Angle"
			}),
			//顶点类型
			pointTypes:new ArrayBufferData({
				length:1,
				name:"a_PointType"
			})
		}
		//纹理
		this.textures = {
			header:{
				name:"texture_head",
				upload:false,
				image:null,
				tex:null,
				location:null,
				index:0
			},
			tail:{
				name:"texture_tail",
				upload:false,
				image:null,
				tex:null,
				location:null,
				index:1
			}
		}

		this.n = 0;

		this.style = options.style || { 
			//过度时间
			enable:true,
			duration:3000,
			repeat:false,
			direction:1,
			header:{
				image:"7cded219b97d53e13de72e318b484646.svg",
				size:24,
				opacity:1
			},
			tail:{
				texture:null,
				length:1,
				size:10,
				color:parseCSSColor("green"),
				style:"arrow" //无，箭头，圆
			}
		};
		
		this.bounds = this.calcBounds();
		this.moveendfn = function(evt){
			_this.bounds =  _this.calcBounds();
			_this.zoom = _this.mbxmap.getZoom();
		};
		this.mbxmap.on("moveend",this.moveendfn);
		this.initPropram();

	}
	/**
	 * 计算当前地图的可视范围
	 * @return {array} 可视范围
	 */
	calcBounds(){
		var bounds = this.mbxmap.getBounds().toArray();
		if(bounds && bounds.length > 0){
			bounds[0] = mapboxgl.MercatorCoordinate.fromLngLat(bounds[0]);
			bounds[1] = mapboxgl.MercatorCoordinate.fromLngLat(bounds[1]);
		}
		return bounds;
	}
	/**
	 * 清除
	 */
	remove(){

		this.mbxmap.off("moveend",this.moveendfn);
		this.gl.deleteShader(this.vertexShader);
		this.gl.deleteShader(this.fragmentShader);
		this.gl.deleteProgram(this.program);
		this.init = false;
		for (var key in this.buffers) {
			this.buffers[key].clear();
		}
	}
	/**
	 * 初始化程序
	 */
	initPropram(){

		var gl = this.gl;

		//创建着色器程序
		var vertexShader = this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource (vertexShader,vertexShaderSource);
		gl.compileShader (vertexShader);
		//获取错误信息
		if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
			console.log(gl.getShaderInfoLog(vertexShader));
			gl.deleteShader(vertexShader);
			return ;
		}

		var fragmentShader = this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader,fragmentShaderSource);
		gl.compileShader(fragmentShader);

		//获取错误信息
		if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
			console.log(gl.getShaderInfoLog(fragmentShader));
			gl.deleteShader(fragmentShader);
			return;
		}

		this.program = gl.createProgram();
		gl.attachShader(this.program, vertexShader);
		gl.attachShader(this.program, fragmentShader);
		gl.linkProgram(this.program);

		if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)){
			console.log(gl.getProgramInfoLog(this.program));
			gl.deleteProgram(this.program);
			return;
		}

		this.matrixLocation = gl.getUniformLocation(this.program, "u_matrix");

		for (var key in this.buffers) {
			this.buffers[key].init(gl,this.program);
		}

		for (var key in this.textures) {
			this.textures[key].location = gl.getUniformLocation(this.program, this.textures[key].name);
		}

		//this.loadTextures();
		this.init = true;

	}
	/**
	 * 加载纹理
	 * @param  {string} imageId 图片id
	 */
	loadTextures(imageId){
		//var _this = this;
		for (var key in this.textures) {
			(function(_this,texture){
				if(texture.name == "texture_head"){
					var imageId = _this.style.header.image;
					var url = getProp("data.meta.url.getFile",_this.map.states);
					url = url.replace("{0}",imageId);
					url = _this.map.getBaseUrl() + url;
					var image = new Image();
					image.crossOrigin = 'Anonymous';
					image.src = url;
					image.onload = function(){
						texture.image = image;
						texture.upload = false;
					};
				}else{
					var style = _this.style.tail.style;
					var canvas = document.createElement("canvas");
					canvas.width = 24;
					canvas.height = 24;
					var context = canvas.getContext("2d");
					graphic[style](context, 12 , 24 , 24);
					texture.image = canvas;
					texture.upload = false;
				}
				
			})(this,this.textures[key]);
		}
	}
	/**
	 * 设置数据
	 * @param {object} data geojson数据
	 */
	setSource(data){
		var _this = this;
		//console.log(data);
		if(typeof data == "string"){
			get(data,function(error,res){
				if(error){
					return;
				}
				_this.transformData(res);
			});
		}else{
			this.transformData(data);
		}
	}
	/**
	 * 数据转换
	 * @param {object} data geojson数据
	 */
	transformData(data){
		var _this = this;
		var arr = [];
		var features = data.features;
		_this.lines.length = 0;
		_this.particles.length = 0;
		_this.n = 0;
		features.forEach(function(feature){
			var geometry = feature.geometry;
			var type = geometry.type;
			var coordinates = geometry.coordinates;
			var i,j,k;
			var forEachFn = null;
			if(type == "LineString"){
				forEachFn = forEachLineString;
			}else if(type == "MultiLineString"){
				forEachFn = forEachMultiLineString;
			}else if(type == "Polygon"){
				forEachFn = forEachPolygon;
			}else if(type == "MultiPolygon"){
				forEachFn = forEachMultiPolygon;
			}
			if(forEachFn){
				forEachFn(coordinates,function(points){
					_this.createElements(points);
					_this.changed = true;
				});
			}
		});
		_this.animation(performance.now());
	}
	/**
	 * 创建粒子元素
	 * @param  {array} points 坐标
	 */
	createElements(points){
		var line = new Line( points );
		this.lines.push( points );
		this.particles.push( new Particle({
			line: line,
			style: this.style,
			buffers: this.buffers,
			index: this.lines.length - 1
		}));
	}
	/**
	 * 坐标转换，将wgs84坐标转换为归一化的web墨卡托坐标系
	 * @param  {array} coord 坐标
	 * @return {array}       转换结果
	 */
	transformCoord(coord){
		var lnglat =  mapboxgl.MercatorCoordinate.fromLngLat(coord)
		var xy = [lnglat.x,lnglat.y];
		return xy
	}
	/**
	 * 动画
	 */
	animation(){
		var time = performance.now();
		for(var key in this.buffers){
			this.buffers[key].length = 0;
		}

		var zoom = this.mbxmap.getZoom();
		var resolution =  0.70312499999999778 / Math.pow(2,zoom);
		for(var i = 0 ; i < this.particles.length ; i ++){
			this.particles[i].stepDuration( time, resolution, this.bounds);
		}
		this.n = this.buffers.position.length / 2;
	}
	//渲染
	render(gl,matrix){
		var _this = this;
		if(this.init && 
				this.visible &&
				this.maxzoom >= this.zoom &&
				this.minzoom <= this.zoom &&
				this.style.enable
			){
			this.animation();
			if(this.n <= 0 ) {
				this.mbxmap.triggerRepaint();
				return;
			};
			gl.useProgram(this.program);
			gl.uniformMatrix4fv(this.matrixLocation, false, matrix);
			gl.uniform1f( 
				gl.getUniformLocation(this.program,'bearing'),
				this.mbxmap.transform.angle || 0
			);
			//绑定buffer到变量
			for(var key in this.buffers){
				gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[key].getGlBuffer());
				gl.bufferData(gl.ARRAY_BUFFER, this.buffers[key].getBuffer() , gl.STATIC_DRAW);
				gl.enableVertexAttribArray(this.buffers[key].location);
				gl.vertexAttribPointer(this.buffers[key].location, this.buffers[key].len, gl.FLOAT, false, 0, 0);
			}
			for(var key in this.textures){
				var texture = this.textures[key];
				if(texture.image && !texture.upload){
					var tex = gl.createTexture();
					texture.tex = tex;
					gl.activeTexture(gl["TEXTURE" + texture.index]);
					gl.bindTexture(gl.TEXTURE_2D,tex);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				    gl.uniform1i( texture.location , texture.index);
				    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE, texture.image);
				    texture.upload = true;
				}else if(texture.image && texture.upload){
					gl.activeTexture(gl["TEXTURE" + texture.index]);
				    gl.bindTexture(gl.TEXTURE_2D,  texture.tex );
				    gl.uniform1i( texture.location ,  texture.index);
				}	
			}
			//内置样式贴图
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			gl.enable(gl.BLEND);
			//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.drawArrays(gl.POINTS,0,this.n);
		}
		this.mbxmap.triggerRepaint();
	}	
	/**
	 * 更新样式
	 * @param  {object} stypeOptions 样式配置
	 */
	updateStyle(stypeOptions){
		var animationStyle = stypeOptions.animation;
		var style = { 
			header:{},
			tail:{}
		};

		style.enable = animationStyle.enable;
		style.duration = animationStyle.duration * 1000;
		style.repeat = animationStyle.loop;
		style.header.image = getProp("headerStyle.icon.image",animationStyle);
		style.header.opacity  = getProp("headerStyle.icon.opacity",animationStyle);
		//方向
		//style.direction = animationStyle.duration
		var width = getProp("headerStyle.icon.width",animationStyle);
		var height = getProp("headerStyle.icon.height",animationStyle);
		var scale = getProp("headerStyle.icon.scale",animationStyle);
		style.header.size = scale * Math.max(width,height);
		var typeMapping = {
			0:"none",
			1:"circle",
			2:"arrow"
		}
		style.tail.length = getProp("footerStyle.length",animationStyle) || 0;
		style.tail.style   = typeMapping[getProp("footerStyle.type",animationStyle) || 0];
		style.tail.size   = (getProp("lineStyle.basicStyle.line.width",stypeOptions) || 3 ) * 3; 
		style.tail.color  = parseCSSColor(getProp("footerStyle.color",animationStyle));

		if(style.repeat != this.style.repeat){
			var time = performance.now();
			for(var i = 0 ; i < this.particles.length ; i ++){
				this.particles[i].reset(time);
			}
		}

		Object.assign(this.style, style);

		this.loadTextures();

	}
}

