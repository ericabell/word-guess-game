console.log('Testing....');

document.addEventListener('keypress', (e) => {
  console.log(`User press: ${e.key}`);
  // send the post request to / with letter="x" in the body
  let XHR = new XMLHttpRequest();
  let urlEncodedData = "";
  let urlEncodedDataPairs = [];
  let name;

  urlEncodedDataPairs.push(encodeURIComponent('letter') + '=' + encodeURIComponent(e.key));

  urlEncodedData = urlEncodedDataPairs.join('&').replace(/%20/g, '+');

  XHR.addEventListener('load', (e) => {
    console.log('data sent and response loaded');
  });

  XHR.addEventListener('error', (e) => {
    console.log('error in sending post' + e);
  });

  XHR.open('POST', 'http://localhost:3000/');

  XHR.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

  XHR.send(urlEncodedData);

  // refresh the page
  // window.location.reload();
})
