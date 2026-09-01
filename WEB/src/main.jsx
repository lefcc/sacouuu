import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Importante para carregar o Tailwind e as fontes
import { SchoolProvider } from './context/SchoolContext.jsx' // Importação do contexto da escola

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SchoolProvider>
      <App />
    </SchoolProvider>
  </React.StrictMode>,
)