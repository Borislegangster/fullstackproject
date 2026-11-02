import { Toaster } from 'react-hot-toast';
export function GlobusToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: "'Open Sans', sans-serif",
          borderRadius: '12px',
          padding: '14px 20px',
          fontSize: '14px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
        },
        success: {
          style: {
            background: '#FB8C43',
            color: '#fff'
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#FB8C43'
          }
        },
        error: {
          style: {
            background: '#EF4444',
            color: '#fff'
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#EF4444'
          }
        }
      }} />);


}