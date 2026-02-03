* {
margin: 0;
padding: 0;
box-sizing: border-box;
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body {
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

.login-container {
    width: 100%;
    max-width: 400px;
    padding: 20px;
}

.login-box {
    background: #ffffff;
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
    text-align: center;
}

.header-logo {
    margin-bottom: 30px;
}

.icon-quality {
    background: #2a5298;
    color: white;
    width: 50px;
    height: 50px;
    line-height: 50px;
    border-radius: 50%;
    font-size: 24px;
    font-weight: bold;
    margin: 0 auto 10px;
}

.header-logo h1 {
font-size: 24px;
color: #333;
        }

        .header-logo span {
color: #2a5298;
}

        .header-logo p {
font-size: 12px;
color: #777;
text-transform: uppercase;
letter-spacing: 1px;
}

        .input-group {
    text-align: left;
    margin-bottom: 20px;
}

.input-group label {
display: block;
font-size: 14px;
color: #555;
margin-bottom: 5px;
}

        .input-group input {
width: 100%;
padding: 12px;
border: 1px solid #ddd;
border-radius: 4px;
outline: none;
transition: border-color 0.3s;
}

        .input-group input:focus {
    border-color: #2a5298;
}

button {
    width: 100%;
    padding: 12px;
    background: #2a5298;
    border: none;
    border-radius: 4px;
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.3s;
    letter-spacing: 1px;
}

button:hover {
    background: #1e3c72;
}

.error-msg {
    color: #d9534f;
    font-size: 13px;
    margin-top: 15px;
    height: 15px;
}