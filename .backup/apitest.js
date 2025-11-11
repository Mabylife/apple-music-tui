async function testEndpoint(method, endpoint, body = null) {
  const baseUrl = document.getElementById("baseUrl").value;
  const apiToken = document.getElementById("apiToken").value;
  const url = baseUrl + endpoint;

  const options = {
    method: method,
    headers: {},
  };

  if (apiToken) {
    options.headers["apitoken"] = apiToken;
  }

  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  document.getElementById("requestInfo").textContent = `${method} ${endpoint}`;
  document.getElementById("responseData").textContent = "Loading...";

  try {
    const response = await fetch(url, options);
    const statusCode = document.getElementById("statusCode");
    statusCode.textContent = `Status: ${response.status} ${response.statusText}`;
    statusCode.className = response.ok ? "success" : "error";

    let data;
    const contentType = response.headers.get("content-type");

    if (response.status === 204) {
      data = "(No content)";
    } else if (contentType && contentType.includes("application/json")) {
      data = await response.json();
      data = JSON.stringify(data, null, 2);
    } else {
      data = await response.text();
    }

    document.getElementById("responseData").textContent = data;
  } catch (error) {
    const statusCode = document.getElementById("statusCode");
    statusCode.textContent = "Error";
    statusCode.className = "error";
    document.getElementById(
      "responseData"
    ).textContent = `Error: ${error.message}\n\nMake sure Cider is running and RPC is enabled!`;
  }
}

async function setVolume() {
  const volume = parseInt(document.getElementById("volumeValue").value);
  if (volume < 0 || volume > 100) {
    alert("Volume must be between 0 and 100");
    return;
  }
  await testEndpoint("POST", "/api/v1/playback/volume", { volume });
}

async function seekTo() {
  const position = parseInt(document.getElementById("seekPosition").value);
  if (isNaN(position) || position < 0) {
    alert("Please enter a valid position in seconds");
    return;
  }
  await testEndpoint("POST", "/api/v1/playback/seek", { position });
}

async function cycleRepeat() {
  await testEndpoint("POST", "/api/v1/playback/repeat");
}

async function testAMAPI(path, method = "GET", body = null) {
  const baseUrl = document.getElementById("baseUrl").value;
  const apiToken = document.getElementById("apiToken").value;
  const url = baseUrl + "/api/v1/amapi/run-v3";

  const requestBody = {
    path: path,
    method: method,
  };

  if (body) {
    requestBody.body = body;
  }

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  };

  if (apiToken) {
    options.headers["apitoken"] = apiToken;
  }

  document.getElementById(
    "requestInfo"
  ).textContent = `AMAPI ${method} ${path}`;
  document.getElementById("responseData").textContent = "Loading...";

  try {
    const response = await fetch(url, options);
    const statusCode = document.getElementById("statusCode");
    statusCode.textContent = `Status: ${response.status} ${response.statusText}`;
    statusCode.className = response.ok ? "success" : "error";

    let data;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
      data = JSON.stringify(data, null, 2);
    } else {
      data = await response.text();
    }

    document.getElementById("responseData").textContent = data;
  } catch (error) {
    const statusCode = document.getElementById("statusCode");
    statusCode.textContent = "Error";
    statusCode.className = "error";
    document.getElementById(
      "responseData"
    ).textContent = `Error: ${error.message}\n\nMake sure Cider is running and RPC is enabled!`;
  }
}

async function searchLibrary() {
  const searchTerm = document.getElementById("searchTerm").value;
  if (!searchTerm) {
    alert("Please enter a search term");
    return;
  }

  const encodedTerm = encodeURIComponent(searchTerm);
  await testAMAPI(
    `/v1/me/library/search?term=${encodedTerm}&types=library-songs,library-albums,library-artists`,
    "GET"
  );
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("responseData").textContent =
    "Click a button to test an API endpoint";
});
