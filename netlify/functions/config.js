exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      mapboxToken: process.env.MAPBOX_ACCESS_TOKEN
    })
  };
};