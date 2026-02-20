const SPRInstructions = () => {
  return (
    <div className="p-6 text-[#1a1a1a] font-sans text-[15px] leading-relaxed w-full">
      <p className="font-bold mb-4">
        For student-produced response questions, solve each problem and enter your answer as described below.
      </p>
      
      <ul className="list-disc pl-5 space-y-3 mb-8 marker:text-black">
        <li>If you find <strong>more than one correct answer</strong>, enter only one answer.</li>
        <li>You can enter up to 5 characters for a <strong>positive answer</strong> and up to 6 characters (including the negative sign) for a <strong>negative answer</strong>.</li>
        <li>If your answer is a <strong>fraction</strong> that doesn't fit in the provided space, enter the decimal equivalent.</li>
        <li>If your answer is a <strong>decimal</strong> that doesn't fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>
        <li>
          If your answer is a <strong>mixed number</strong> (such as 3<span className="inline-flex flex-col align-middle text-[0.7em] ml-0.5"><span className="border-b border-black leading-none pb-[1px]">1</span><span className="leading-none pt-[1px]">2</span></span>), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).
        </li>
        <li>Don't enter <strong>symbols</strong> such as a percent sign, comma, or dollar sign.</li>
      </ul>

      <h4 className="font-bold text-center mb-3 text-[16px]">Examples</h4>
      
      <div className="w-full overflow-hidden border border-black">
        <table className="w-full border-collapse text-center text-sm">
          <thead>
            <tr>
              <th className="border border-black px-3 py-3 font-normal w-1/4">Answer</th>
              <th className="border border-black px-3 py-3 font-normal w-2/4">Acceptable ways to enter answer</th>
              <th className="border border-black px-3 py-3 font-normal w-1/4">Unacceptable: will NOT receive credit</th>
            </tr>
          </thead>
          <tbody>
            {/* Row 1: 3.5 */}
            <tr>
              <td className="border border-black px-3 py-3 align-top">3.5</td>
              <td className="border border-black px-3 py-3 align-top leading-loose">
                3.5<br />
                3.50<br />
                7/2
              </td>
              <td className="border border-black px-3 py-3 align-top leading-loose">
                31/2<br />
                3 1/2
              </td>
            </tr>
            {/* Row 2: 2/3 */}
            <tr>
              <td className="border border-black px-3 py-3 align-top">
                <div className="flex flex-col items-center justify-center w-max mx-auto">
                  <span className="border-b border-black px-1 leading-none pb-[2px]">2</span>
                  <span className="leading-none pt-[2px]">3</span>
                </div>
              </td>
              <td className="border border-black px-3 py-3 align-top leading-loose">
                2/3<br />
                .6666<br />
                .6667<br />
                0.666<br />
                0.667
              </td>
              <td className="border border-black px-3 py-3 align-top leading-loose">
                0.66<br />
                .66<br />
                0.67<br />
                .67
              </td>
            </tr>
            {/* Row 3: -1/3 */}
            <tr>
              <td className="border border-black px-3 py-3 align-top">
                 <div className="flex items-center justify-center w-max mx-auto gap-1">
                  <span>–</span>
                  <div className="flex flex-col items-center justify-center">
                    <span className="border-b border-black px-1 leading-none pb-[2px]">1</span>
                    <span className="leading-none pt-[2px]">3</span>
                  </div>
                </div>
              </td>
              <td className="border border-black px-3 py-3 align-top leading-loose">
                -1/3<br />
                -.3333<br />
                -0.333
              </td>
              <td className="border border-black px-3 py-3 align-top leading-loose">
                -.33<br />
                -0.33
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SPRInstructions;