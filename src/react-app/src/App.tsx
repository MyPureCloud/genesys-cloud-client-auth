import React from 'react';

import './App.css';

declare var GenesysCloudClientAuth: {
  handleRedirectFromLogin: () => void;
};

// declare var GenesysCloudClientAuth: {
//   handleRedirectFromLogin: () => void;
// };

function App () {
  let response = 'We have successfully stored login information to our domain\'s localStorage';

  try {
    GenesysCloudClientAuth.handleRedirectFromLogin();
  } catch (e) {
    response = e.name + ': ' + e.message;
  }

  return (
    <div className="App">
      {response}
    </div>
  );
}

export default App;
