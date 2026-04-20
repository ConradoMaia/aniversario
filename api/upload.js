const { handleBlobUploadApi } = require("../lib/upload-api");

module.exports = async function upload(request, response) {
  await handleBlobUploadApi(request, response);
};
