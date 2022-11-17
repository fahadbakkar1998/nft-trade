import React, { useEffect } from "react"
import { Button } from "@mui/material"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { usePlug } from "@raydeck/useplug"

import { inventoryBoxNum, nullPrincipalId } from "./utils/constants"
import { clone, existItems, getInventoryBoxes, getRemoteBoxes, getUserTokens } from "./utils/funcs"
import { useStore } from "./utils/store"
import { trade_canister } from "./trade_canister/index"

import Frame from "./Frame"
import RemoteBox from "./RemoteBox"
import BagBox from "./BagBox"
import BagItem from "./BagItem"
import { Loading } from "./Loading"
import { ItemDetails } from "./ItemDetails"

const url = new URL(window.location.href)
const tradeId = url.searchParams.get("tradeId")
tradeId && console.log("I'm joiner. tradeId: ", tradeId)
let inventoryTokens = []
let partner
const updatePartner = val => {
  partner = val
}

export const Trade = () => {
  const { authenticated, principal, login, agent } = usePlug()
  const {
    isCreator,
    setIsCreator,
    tradeData,
    setTradeData,
    remoteBoxes,
    setRemoteBoxes,
    localBoxes,
    setLocalBoxes,
    inventoryBoxes,
    setInventoryBoxes,
    plugActor,
    setPlugActor,
    tradeStarted,
    setTradeStarted,
    accepted,
    setAccepted,
    boxNumPerPage,
    curPage,
    setCurPage,
    setLoading,
    localUser,
    setLocalUser,
    curTradeId,
    setCurTradeId,
  } = useStore()
  const principalString = principal ? window.ic.plug.principalId : "<none>"

  useEffect(() => {
    (async () => {
      if (!principal) return
      setLoading(true)
      const user = window.ic.plug.principalId
      console.log("local user: ", user)
      // const balance = await window.ic.plug.requestBalance()
      // console.log("balance: ", balance)
      const newTokens = await getUserTokens({ agent, user })
      inventoryTokens = clone(newTokens)
      console.log('newTokens: ', newTokens)
      setLocalUser(user)
      setInventoryBoxes(getInventoryBoxes(newTokens))
      if (tradeId) {
        startTrade()
      }
      setLoading(false)
    })()
  }, [principal])

  useEffect(() => {
    (async () => {
      if (!plugActor || !localUser) return
      setLoading(true)
      console.log('plugActor: ', plugActor)
      let trade

      if (tradeId) {
        console.log("***** TRADE DETECTED *****")
        trade = await plugActor.get_trade_by_id(tradeId)
        setIsCreator(false)
      } else {
        trade = await plugActor.create_trade(localUser)
        setIsCreator(true)
      }

      console.log('trade: ', trade)
      setCurTradeId(trade.id)
      setTradeData(trade)
      setTradeStarted(true)
      setLoading(false)
    })()
  }, [plugActor])

  useEffect(() => {
    (async () => {
      if (!plugActor && !curTradeId && !tradeData) return
      setLoading(true)
      // const host = Principal.fromUint8Array(tradeData.host._arr).toText()
      // const guest = Principal.fromUint8Array(tradeData.guest._arr).toText()
      const host = tradeData.host
      const guest = tradeData.guest
      // console.log('host: ', host)
      // console.log('guest: ', guest)

      if (!isCreator && guest !== nullPrincipalId && guest !== localUser) {
        return console.error(
          "Trade already initialized to another wallet: ",
          guest
        )
      }

      if (isCreator && guest !== nullPrincipalId && guest !== localUser && guest !== host && guest !== partner) {
        console.log('trade partner found(guest): ', guest)
        updatePartner(guest)
      }

      if (!isCreator && host !== nullPrincipalId && host !== localUser && host !== partner) {
        console.log('trade partner found(host): ', host)
        await plugActor.join_trade(localUser, curTradeId)
        updatePartner(host)
      }

      if (isCreator) {
        const rb = getRemoteBoxes(tradeData.guestData)
        console.log('guestData: ', tradeData.guestData)
        console.log('remoteBoxes: ', rb)
        setRemoteBoxes(rb)
      } else {
        const rb = getRemoteBoxes(tradeData.hostData)
        console.log('hostData: ', tradeData.hostData)
        console.log('remoteBoxes: ', rb)
        setRemoteBoxes(rb)
      }

      setLoading(false)
    })()
  }, [tradeData])

  // Fetch data from IC in real time
  useEffect(() => {
    if (!plugActor) return
    const interval = setInterval(async () => {
      const trade = await plugActor.get_trade_by_id(curTradeId)
      setTradeData(trade)
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [curTradeId])

  const startTrade = async () => {
    setPlugActor(trade_canister)
  }

  const onAccept = () => {
    if (!plugActor) return
    plugActor.accept(localUser, tradeData.id)
    setAccepted(true)
    console.log("Trade accepted!")
  }

  const onCancel = () => {
    if (!plugActor) return
    plugActor.cancel(localUser, tradeData.id)
    setAccepted(false)
    console.log("Trade canceled!")
  }

  const onPrevPage = () => {
    if (curPage <= 1) return
    setCurPage(curPage - 1)
  }

  const onNextPage = () => {
    const pageNum = Math.ceil(inventoryBoxNum / boxNumPerPage)
    if (curPage >= pageNum) return
    setCurPage(curPage + 1)
  }

  return (
    <div className="w-full h-full">
      <DndProvider backend={HTML5Backend}>
        <Loading />
        <ItemDetails />
        <div className="absolute top-0 left-0 w-3/4 h-full">
          {!authenticated && (
            <Frame className="absolute w-full h-full">
              <div className="flex items-center justify-center w-full h-full">
                <Button variant="contained" onClick={login}>
                  Connect
                </Button>
              </div>
            </Frame>
          )}
          {authenticated && !tradeData && (
            <Frame className="absolute w-full h-full">
              <div className="flex items-center justify-center w-full h-full">
                {!tradeStarted && (
                  <Button variant="contained" onClick={startTrade}>
                    Start Trade
                  </Button>
                )}
                {tradeStarted && !tradeData && (
                  <Button variant="disabled">Starting...</Button>
                )}
              </div>
            </Frame>
          )}
          {authenticated && tradeData && (
            <div className="absolute w-full h-full overflow-auto">
              <Frame>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">Their Trade</div>
                    <div className="text-xl text-blue-900">
                      {(isCreator && tradeData.guestAccept) ||
                        (!isCreator && tradeData.hostAccept)
                        ? "TRADE ACCEPTED"
                        : "Waiting..."}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {remoteBoxes.map((box, index) => {
                      return (
                        <RemoteBox key={box.id}>
                          <BagItem
                            key={`remote_${box.id}`}
                            item={clone(box.item)}
                            index={index}
                            tradeBoxes={clone(remoteBoxes)}
                            updateTradeBoxes={setRemoteBoxes}
                            tradeLayer="remote"
                          />
                        </RemoteBox>
                      )
                    })}
                  </div>
                </div>
              </Frame>
              <Frame>
                <div className="flex flex-col gap-2">
                  <div className="text-2xl">Your Trade</div>
                  <div className="flex flex-wrap gap-3">
                    {localBoxes.map((box, index) => {
                      return (
                        <BagBox key={box.id}>
                          <BagItem
                            key={`local_${box.id}`}
                            isForTrade={true}
                            item={clone(box.item)}
                            index={index}
                            tradeBoxes={clone(localBoxes)}
                            updateTradeBoxes={setLocalBoxes}
                            tradeLayer="local"
                          />
                        </BagBox>
                      )
                    })}
                  </div>
                </div>
              </Frame>
              <Frame>
                <div className="flex flex-wrap items-center justify-center w-full h-full gap-8">
                  <Button
                    variant="contained"
                    onClick={onAccept}
                    disabled={accepted || !existItems(localBoxes)}
                    color="success"
                  >
                    Accept
                  </Button>
                  <div className="flex items-center justify-center gap-2">
                    {/* Numerical input for amount of ICP to add to trade */}
                    <label htmlFor="icp">ICP: </label>
                    <input
                      className="w-32 p-0.5 text-xl border rounded opacity-30 bg-amber-900"
                      id="icp"
                      type="number"
                    />
                  </div>
                  <Button
                    variant="contained"
                    onClick={onCancel}
                    disabled={!accepted && existItems(localBoxes)}
                    color="error"
                  >
                    Cancel
                  </Button>
                </div>
              </Frame>
              <Frame>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">Inventory</div>
                    <div className="flex items-center gap-2 text-xl">
                      <div className="cursor-pointer" onClick={onPrevPage}>
                        &#60
                      </div>
                      <div className="text-blue-900">{curPage}</div>
                      <div className="cursor-pointer" onClick={onNextPage}>
                        &#62
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {inventoryBoxes
                      .slice(
                        (curPage - 1) * boxNumPerPage,
                        curPage * boxNumPerPage
                      )
                      .map((box, index) => {
                        return (
                          <BagBox key={box.id}>
                            <BagItem
                              key={`inventory_${box.id}`}
                              item={clone(box.item)}
                              index={(curPage - 1) * boxNumPerPage + index}
                              tradeBoxes={clone(inventoryBoxes)}
                              updateTradeBoxes={setInventoryBoxes}
                              tradeLayer="inventory"
                            />
                          </BagBox>
                        )
                      })}
                  </div>
                </div>
              </Frame>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-1/4 h-full">
          <Frame className="h-full">
            <div className="p-2">
              <b>CONNECTION STATUS</b>
              <br />
              {authenticated && principal
                ? "Connected with " + principalString
                : "Waiting for IC wallet connection..."}
              <br />
              <br />
              {tradeStarted && tradeData && !partner && !tradeId && (
                <>
                  <b> WAITING FOR TRADE PARTNER... </b>
                  <br />
                  Send this link to your trade partner
                  <br />
                  <a
                    className="text-blue-900"
                    href={`${url.host}/?tradeId=${tradeData.id}`}
                  >
                    {url.host}/?tradeId={tradeData.id}
                  </a>
                </>
              )}
              {tradeStarted && tradeData && partner && (
                <>Trading with {partner}</>
              )}
            </div>
          </Frame>
        </div>
      </DndProvider>
    </div>
  )
}
