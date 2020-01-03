# migrate
基于原生webgl开发的迁移图，在mapbox上使用效果更佳
```
var trackLayer = {
  type: 'custom',
  onAdd: function (map, gl) {
    this.migrateGL = _this.migrateGL = new MigrateGL({
      mbxmap:map,
      map:_this.map,//外部封装的一个map对象，使用时酌情修改
      maxzoom:22,
      minzoom:0,
      gl:gl
    });
    this.migrateGL.updateStyle({
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
    });
    var source = map.getSource("sourceid");
    var data = source._data;
    this.migrateGL.setSource(data);

  },
  render: function (gl, matrix) {
    this.migrateGL.render(gl,matrix);
  }
};
```
