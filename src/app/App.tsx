import { BrowserRouter, Routes, Route } from 'react-router';
import HomePage from './routes/HomePage';
import BoardPage from './routes/BoardPage';
import HostSetupPage from './routes/HostSetupPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/board/:boardId" element={<BoardPage />} />
        <Route path="/host/:boardId?" element={<HostSetupPage />} />
      </Routes>
    </BrowserRouter>
  );
}
