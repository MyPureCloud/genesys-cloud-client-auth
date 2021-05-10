import React from 'react';

import { handleRedirectFromLogin } from '../lib';

import './App.css';

function App () {
  let response = 'We have successfully stored login information to our domain\'s localStorage';

  try {
    handleRedirectFromLogin();
  } catch (e) {
    response = e.name + ': '+ e.message;
  }

  return (
    <div className="App">
      {response}
    </div>
  );
}

export default App;
