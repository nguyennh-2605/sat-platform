import React from 'react';

const SingleColumnLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // THẺ NGOÀI CÙNG: Rộng 100%, có scroll bar. Vì nó rộng 100% nên thanh cuộn sẽ dính sát mép phải.
    <div className="flex-1 w-full h-full bg-white overflow-y-auto custom-scrollbar">
      
      <div className="w-full max-w-4xl mx-auto p-8 md:p-12 flex flex-col">
        {children}
        <div className="h-40 w-full shrink-0"></div>
      </div>
    </div>
  );
};

export default SingleColumnLayout;