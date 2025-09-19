// src/App.tsx
import { Routes, Route } from "react-router-dom";
import SubmissionForm from "./components/SubmissionForm";
import Admin from "../pages/admin";

function App() {
  return (
    <Routes>
      <Route path="/" element={<SubmissionForm />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default App;
