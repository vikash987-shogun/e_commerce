const axios = require('axios');

const CLARIFAI_PAT = 'db10acb749e149caa6e40e5f690c732c';
const USER_ID = 'clarifai';       
const APP_ID = 'main';
const MODEL_ID = 'food-item-recognition';
const MODEL_VERSION_ID = '1d5fd481e0cf4826aa72ec3ff049e044';    
const IMAGE_URL = 'https://samples.clarifai.com/food.jpg';

const raw = JSON.stringify({
  "user_app_id": {
      "user_id": USER_ID,
      "app_id": APP_ID
  },
  "inputs": [
      {
          "data": {
              "image": {
                  "url": IMAGE_URL
              }
          }
      }
  ]
});

const requestOptions = {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Authorization': 'Key ' + CLARIFAI_PAT
    },
    data: raw
};

axios(`https://api.clarifai.com/v2/models/${MODEL_ID}/versions/${MODEL_VERSION_ID}/outputs`, requestOptions)
  .then(response => {
    console.log('Success! API output:');
    const concepts = response.data.outputs[0].data.concepts;
    concepts.slice(0, 5).forEach(c => console.log(`${c.name}: ${c.value}`));
  })
  .catch(error => console.error('Error:', error.response?.data || error.message));
