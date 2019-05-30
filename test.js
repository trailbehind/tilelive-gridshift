var gridshift = require("./lib/index");

new gridshift("gridshift:///", (err, source) => {
  if (err) {
    return console.log(err);
  }
  console.log("Got source.");
  source.getTileGeojsonData(14, 3140, 5893, (err, geojson) => {
    console.log(JSON.stringify(geojson));
  });
});
