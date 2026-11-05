export default function Toast({ message, type = 'success' }) {
  return (
    <div className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}>
      {message}
    </div>
  );
}
