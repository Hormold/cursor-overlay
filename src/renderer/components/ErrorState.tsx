interface ErrorStateProps {
  message: string;
}

const ErrorState = ({ message }: ErrorStateProps) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-red-400 text-sm">Error: {message}</div>
  </div>
);

export default ErrorState;
