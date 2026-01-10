import { useState } from 'react';

import Ic_ArrowUp from '../../assets/ic_arrow_up.svg?react';
import Ic_Arrow from '../../assets/ic_arrow.svg?react';

const ExpandableComponent = ({ id, header, children, defaultOpened }) => {
  const [open, setOpen] = useState(defaultOpened ?? false);

  return (
    <div
      className="mainPage-main-components-infoCard-row"
      style={{
        marginBottom: '0',
      }}
    >
      <div className="mainPage-main-components-infoCard">
        <div
          className="mainPage-main-components-infoCard-header"
          onClick={() => setOpen(!open)}
          id={id}
          style={{
            userSelect: 'none',
            fontSize: '18px',
            fontWeight: '500',
          }}
        >
          {header}
          {open ? (
            <>
              <Ic_ArrowUp
                style={{
                  color: '#4f5660',
                  maxWidth: '125px',
                  maxHeight: '125px',
                  width: '100px',
                  position: 'absolute',
                  right: '-20px',
                }}
              />
            </>
          ) : (
            <>
              <Ic_Arrow
                style={{
                  color: '#4f5660',
                  maxWidth: '125px',
                  maxHeight: '125px',
                  width: '100px',
                  position: 'absolute',
                  right: '-20px',
                }}
              />
            </>
          )}
        </div>
        <div
          className="mainPage-main-components-infoCard-components"
          style={{
            display: 'block',
          }}
        >
          {open ? <>{children}</> : <></>}
        </div>
      </div>
    </div>
  );
};

export default ExpandableComponent;
