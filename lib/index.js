"use strict";

module.exports = GridShift;

const bearing = require("@turf/bearing");
const debug = require("debug")("gridshift");
const distance = require("@turf/distance");
const geojsonVt = require("geojson-vt");
const SphericalMercator = require("@mapbox/sphericalmercator");
const tilelive = require("@mapbox/tilelive");
const vtpbf = require("vt-pbf");
const zlib = require("zlib");
const { exec } = require("child_process");

const nad27Towgs84 =
  "+proj=latlong +datum=NAD27 +to +proj=latlong +datum=WGS84";
//"+proj=latlong +datum=NAD27 +ellps=clrk66 +nadgrids=@conus,@alaska,@ntv1_can.dat +to +proj=latlong +datum=WGS84 +ellps=WGS84 +towgs84=0,0,0"

const merc = new SphericalMercator({
  size: 256
});

function GridShift(uri, callback) {
  this.minzoom = 0;
  this.maxzoom = 14;
  callback(null, this);
}

GridShift.prototype.getTileGeojsonData = function(z, x, y, callback) {
  let tileBbox = merc.bbox(x, y, z, false, "WGS84");
  let center = [
    (tileBbox[0] + tileBbox[2]) / 2.0,
    (tileBbox[1] + tileBbox[3]) / 2.0
  ];
  exec(
    `echo ${center[0]} ${center[1]} | cs2cs -f '%f' ${nad27Towgs84}`,
    (err, stdout, stderr) => {
      if (err) {
        return callback(err, null);
      }
      let tokens = stdout.split(/[\\t\s]+/);
      debug(tokens);
      let shiftedPoint = [parseFloat(tokens[0]), parseFloat(tokens[1])];

      var geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              crs: "WGS84"
            },
            geometry: {
              type: "Point",
              coordinates: center
            }
          },
          {
            type: "Feature",
            properties: {
              crs: "NAD27"
            },
            geometry: {
              type: "Point",
              coordinates: shiftedPoint
            }
          },
          {
            type: "Feature",
            properties: {
              distance: distance(center, shiftedPoint, { units: "meters" }),
              bearing: bearing(center, shiftedPoint)
            },
            geometry: {
              type: "LineString",
              coordinates: [center, shiftedPoint]
            }
          }
        ]
      };
      callback(null, geojson);
    }
  );
};

GridShift.prototype.getTile = function(z, x, y, callback) {
  debug("get tile " + z + "/" + x + "/" + y);
  this.getTileGeojsonData(z, x, y, (err, geojson) => {
    if (err) {
      return callback(err, null);
    }
    var tileindex = geojsonVt(geojson);
    var tile = tileindex.getTile(z, x, y);
    var buff = vtpbf.fromGeojsonVt({ gridshift: tile });
    zlib.gzip(buff, function(err, compressed) {
      if (err) {
        return callback(err, null);
      }
      callback(null, compressed);
    });
  });
};

GridShift.prototype.getInfo = function(callback) {
  callback(null, {
    name: this.name,
    minzoom: this.minzoom,
    maxzoom: this.maxzoom,
    center: [-119.4835, 37.8042, 12],
    bounds: [-180, -85.0511, 180, 85.0511],
    format: "pbf"
  });
};

/*
    Register protocol with tilelive 
*/

GridShift.registerProtocols = function(tilelive) {
  tilelive.protocols["gridshift:"] = GridShift;
};
GridShift.registerProtocols(tilelive);
