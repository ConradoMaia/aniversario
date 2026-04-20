const { handleContentApi } = require("../lib/content-api");

module.exports = async function content(request, response) {
  await handleContentApi(request, response);
};
