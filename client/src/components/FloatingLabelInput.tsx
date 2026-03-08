import React from 'react';

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({ 
  label, 
  id, 
  type = 'text', 
  ...props 
}) => {
  return (
    <div className="relative w-full">
      <input
        type={type}
        id={id}
        // Class 'peer' là linh hồn của hiệu ứng này
        className="block px-4 pb-2.5 pt-4 w-full text-base text-slate-800 bg-white rounded-xl border border-slate-300 appearance-none focus:outline-none focus:ring-0 focus:border-indigo-600 peer transition-colors"
        placeholder=" "
        {...props}
      />
      <label
        htmlFor={id}
        // Các class xử lý hiệu ứng bay lên bay xuống
        className="absolute text-base text-slate-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-1 
                   peer-focus:px-2 peer-focus:text-indigo-600 
                   peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 
                   peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-3 cursor-text"
      >
        {label}
      </label>
    </div>
  );
};

export default FloatingLabelInput;