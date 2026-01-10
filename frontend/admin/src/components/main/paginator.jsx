import { useState } from 'react';

import Ic_pageLeft from '../../assets/ic_pageLeft.svg?react';
import Ic_pageRight from '../../assets/ic_pageRight.svg?react';

const Paginator = ({ header, tabs, children, maxPerPage = 5 }) => {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(children.length / maxPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const startIndex = currentPage * maxPerPage;
  const paginatedChildren =
    children.length > maxPerPage ? children.slice(startIndex, startIndex + maxPerPage) : children;

  return (
    <div className="mainPage-main-components-infoCard-row">
      <div className="mainPage-main-components-infoCard">
        <div className="mainPage-main-components-infoCard-header">{header}</div>
        {children.length > maxPerPage ? (
          <>
            <div className="mainPage-main-components-paginator-pages">
              Page {currentPage + 1} of {totalPages}
            </div>
          </>
        ) : (
          <></>
        )}
        <div className="mainPage-main-components-infoCard-components">
          <table className="mainPage-main-components-infoCard-table">
            <thead>
              <tr>
                {tabs.map((tab) => (
                  <th className="mainPage-main-components-infoCard-table-th" key={tab}>
                    <div
                      className="mainPage-main-components-infoCard-table-th-header"
                      style={{ textAlign: 'left' }}
                    >
                      {tab}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{paginatedChildren}</tbody>
          </table>
        </div>
        {children.length > maxPerPage ? (
          <>
            <div className="mainPage-main-components-infoCard-footer">
              <div className="mainPage-main-components-navigation">
                <div className="mainPage-main-components-paginator">
                  <div className="mainPage-main-components-paginator-inner">
                    <div
                      className="mainPage-main-components-paginator-arrow"
                      id="left"
                      onClick={handlePrevPage}
                    >
                      <Ic_pageLeft style={{ fill: 'currentColor' }} />
                    </div>
                    <div className="mainPage-main-components-paginator-separator"></div>
                    <div
                      className="mainPage-main-components-paginator-arrow"
                      id="right"
                      onClick={handleNextPage}
                    >
                      <Ic_pageRight style={{ fill: 'currentColor' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
};

export default Paginator;
