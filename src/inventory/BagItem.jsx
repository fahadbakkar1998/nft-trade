import React, { useEffect, memo, Fragment } from "react";
import { useDrag } from "react-dnd";
import StyledBagItem from "./BagItem.style";
import { getEmptyImage } from "react-dnd-html5-backend";
import ReactTooltip from "react-tooltip";
import StyledItemTooltip from "./ItemTooltip.style";

export const PresentationalBagItem = ({
  drag,
  isDragging,
  item,
  containerId
}) => {
  if (!item) return null;

  const json = item.metadata.json.value.TextContent;
  console.log('json', json)
  console.log('json.image');
  return (
    <StyledItemTooltip>
      <StyledBagItem
        ref={drag}
        isDragging={isDragging}
        data-tip
        data-for={containerId.toString()}
      >
      ok
        <img src={json.image} />
      </StyledBagItem>
      {!isDragging && (
        <ReactTooltip
          id={containerId.toString()}
          effect="solid"
          border={false}
          className="react-tooltip"
        >
              <strong>{json.name}</strong>
              <br />
              {json.description}
        </ReactTooltip>
      )}
    </StyledItemTooltip>
  );
};

const BagItem = ({ item, bagId, isForTrade }) => {
  console.log('item, bagId, isForTrade', item, bagId, isForTrade)
  item.isForTrade = isForTrade;
  item.type = "all";
  const [{ isDragging }, drag, preview] = useDrag({
    item,
    canDrag: true,
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  });
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, []);

  return (
    <PresentationalBagItem
      containerId={item.id}
      drag={drag}
      isDragging={isDragging}
      item={item}
    />
  );
};

export default memo(BagItem);
