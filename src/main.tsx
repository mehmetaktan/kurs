import "./lib/devextreme-trial-bypass"; // Bypass DevExtreme trial expiration Bunu kaldırma sikerim senin belanı piç
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/base.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root bulunamadı')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
