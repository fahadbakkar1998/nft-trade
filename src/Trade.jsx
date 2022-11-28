import React, { useEffect } from "react"
import { Button } from "@mui/material"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Principal } from "@dfinity/principal"

import { inventoryBoxNum, pageBoxNum } from "./utils/constants"
import { canisterItemsToTokens, clone, existItems, getInventoryBoxes, getPrincipalId, getRemoteBoxes, getUserTokens } from "./utils/funcs"
import { useStore } from "./store"
import { idlFactory } from "../trade_canister/src/declarations/trade_canister/index"

import Frame from "./Frame"
import RemoteBox from "./RemoteBox"
import BagBox from "./BagBox"
import BagItem from "./BagItem"
import { Loading } from "./Loading"
import { ItemDetails } from "./ItemDetails"

const { ic } = window
const { plug } = ic

const canisterId = "rrkah-fqaaa-aaaaa-aaaaq-cai"
const whitelist = [canisterId]
const host = 'http://127.0.0.1:4943'
const timeout = 50000

const url = new URL(window.location.href)
const tradeId = url.searchParams.get("tradeId")
tradeId && console.log("I'm joiner. tradeId: ", tradeId)

export const Trade = () => {
  const {
    isCreator,
    setIsCreator,
    partnerId,
    setPartnerId,
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
    curPage,
    setCurPage,
    setLoading,
    curTradeId,
    setCurTradeId,
    principal,
    setPrincipal,
    authenticated,
    setAuthenticated,
    inventoryTokens,
    setInventoryTokens,
    partnerTokens,
    setPartnerTokens,
  } = useStore()

  const localUserId = principal ? plug.principalId : ''

  const login = async () => {
    if (!plug) return
    console.log('initial plug: ', plug)

    // const isConnected = await plug?.isConnected()
    // console.log('isConnected: ', isConnected)
    // if (!isConnected) return

    const publicKey = await plug.requestConnect({
      whitelist, host, timeout,
      onConnectionUpdate: () => {
        console.log('sessionData: ', plug.sessionManager.sessionData)
      }
    })

    if (publicKey) {
      console.log('publicKey: ', publicKey)
      await onConnected()
    }
  }

  const onConnected = async () => {
    console.log('plug: ', plug)
    if (!plug.agent) return
    const principal = await plug.agent.getPrincipal()
    setPrincipal(principal)
    setAuthenticated(true)
  }

  useEffect(() => {
    (async () => {
      if (!plug.agent) return
      const tempPartnerTokens = await getUserTokens({ agent: plug.agent, user: Principal.fromText(partnerId) })
      console.log('tempPartnerTokens: ', tempPartnerTokens)
      setPartnerTokens(tempPartnerTokens)
    })()
  }, [partnerId])

  // handle guest joining existing trade from link
  useEffect(() => {
    (async () => {
      if (!principal) return
      setLoading(true)
      // const balance = await plug.requestBalance()
      // console.log("balance: ", balance)
      const newTokens = await getUserTokens({ agent: plug.agent, user: principal })
      setInventoryTokens(clone(newTokens))
      setInventoryBoxes(getInventoryBoxes(newTokens))

      // // if user is guest, join the trade
      // if (tradeId) {
      //   startTrade()
      // }
      setLoading(false)
    })()
  }, [principal])

  useEffect(() => {
    (async () => {
      if (!plugActor) return
      setLoading(true)
      console.log('plugActor: ', plugActor)
      let trade

      if (tradeId) {
        console.log("***** TRADE DETECTED *****")
        trade = await plugActor.get_trade_by_id(tradeId)
        setIsCreator(false)
      } else {
        trade = await plugActor.create_trade()
        setIsCreator(true)
      }

      console.log('trade: ', trade)
      setTradeData(trade)
      setCurTradeId(trade.id)
      setTradeStarted(true)
      setLoading(false)
    })()
  }, [plugActor])

  // fetch data from IC in real time (run if trade is existed)
  useEffect(() => {
    if (!curTradeId || !plugActor) return
    console.log('curTradeId: ', curTradeId)
    const interval = setInterval(async () => {
      const trade = await plugActor.get_trade_by_id(curTradeId)
      console.log('real time trade: ', trade)
      setTradeData(trade)
    }, 2000)
    return () => {
      clearInterval(interval)
    }
  }, [curTradeId])

  // update game status whenever trade data is changed
  useEffect(() => {
    (async () => {
      if (!plugActor || !curTradeId || !tradeData || !localUserId) return
      console.log('tradeData: ', tradeData)
      setLoading(true)
      const hostId = getPrincipalId(tradeData.host)
      const guestId = getPrincipalId(tradeData.guest)
      console.log('hostId: ', hostId)
      console.log('guestId: ', guestId)

      if (!isCreator && guestId && guestId !== localUserId) {
        return console.error(
          "Trade already initialized to another wallet: ",
          guestId
        )
      }

      if (isCreator && guestId && guestId !== partnerId) {
        console.log('trade partner found(guestId): ', guestId)
        setPartnerId(guestId)
      }

      if (!isCreator && hostId && hostId !== partnerId) {
        console.log('trade partner found(hostId): ', hostId)
        await plugActor.join_trade(curTradeId)
        setPartnerId(hostId)
      }

      console.log('isCreator: ', isCreator)
      const rts = isCreator ? canisterItemsToTokens(tradeData.guest_items, partnerTokens) : canisterItemsToTokens(tradeData.host_items, partnerTokens)
      console.log('remoteTokens: ', rts)
      const rbs = getRemoteBoxes(rts)
      console.log('remoteBoxes: ', rbs)
      setRemoteBoxes(rbs)
      setLoading(false)
    })()
  }, [tradeData])

  const startTrade = async () => {
    if (!plug.createActor) return
    const tempPlugActor = await plug.createActor({ canisterId, interfaceFactory: idlFactory })
    setPlugActor(tempPlugActor)
  }

  const onConnect = async () => {
    console.log('Connecting...')
    login()
  }

  const onAccept = () => {
    if (!plugActor) return
    plugActor.accept(tradeData.id)
    setAccepted(true)
    console.log("Trade accepted!")
  }

  const onCancel = () => {
    if (!plugActor) return
    plugActor.cancel(tradeData.id)
    setAccepted(false)
    console.log("Trade canceled!")
  }

  const onPrevPage = () => {
    if (curPage <= 1) return
    setCurPage(curPage - 1)
  }

  const onNextPage = () => {
    const pageNum = Math.ceil(inventoryBoxNum / pageBoxNum)
    if (curPage >= pageNum) return
    setCurPage(curPage + 1)
  }

  return (
    <div className="w-full h-full">
      <DndProvider backend={HTML5Backend}>
        <ItemDetails />
        <div className="absolute top-0 left-0 w-3/4 h-full overflow-auto">
          <Loading />
          {!authenticated && (
            <Frame className="h-full">
              <div className="flex items-center justify-center h-full">
                <Button variant="contained" onClick={onConnect}>
                  Connect
                </Button>
              </div>
            </Frame>
          )}
          {authenticated && !tradeData && (
            <Frame>
              <div className="flex items-center justify-center h-full">
                {!tradeStarted && (
                  <Button variant="contained" onClick={startTrade}>
                    Start Trade
                  </Button>
                )}
                {tradeStarted && (
                  <Button variant="disabled">Starting...</Button>
                )}
              </div>
            </Frame>
          )}
          {authenticated && tradeData && (
            <>
              <Frame>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">Their Trade</div>
                    <div className="text-xl text-blue-900">
                      {(isCreator && tradeData.guest_accept) ||
                        (!isCreator && tradeData.host_accept)
                        ? "TRADE ACCEPTED"
                        : ""}
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
                            setTradeBoxes={setRemoteBoxes}
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
                            setTradeBoxes={setLocalBoxes}
                            tradeLayer="local"
                          />
                        </BagBox>
                      )
                    })}
                  </div>
                </div>
              </Frame>
              <Frame>
                <div className="flex flex-wrap items-center justify-center gap-8">
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
            </>
          )}
          {principal && (
            <Frame>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-2xl">Inventory</div>
                  <div className="flex items-center gap-2 text-xl">
                    <div className="cursor-pointer" onClick={onPrevPage}>
                      &#60;
                    </div>
                    <div className="text-blue-900">{curPage}</div>
                    <div className="cursor-pointer" onClick={onNextPage}>
                      &#62;
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {inventoryBoxes
                    .slice(
                      (curPage - 1) * pageBoxNum,
                      curPage * pageBoxNum
                    )
                    .map((box, index) => {
                      return (
                        <BagBox key={box.id}>
                          <BagItem
                            key={`inventory_${box.id}`}
                            item={clone(box.item)}
                            index={(curPage - 1) * pageBoxNum + index}
                            tradeBoxes={clone(inventoryBoxes)}
                            setTradeBoxes={setInventoryBoxes}
                            tradeLayer="inventory"
                          />
                        </BagBox>
                      )
                    })}
                </div>
              </div>
            </Frame>
          )}
        </div>
        <div className="absolute top-0 right-0 w-1/4 h-full overflow-auto">
          <Frame className="h-full">
            <div className="p-2">
              <b>CONNECTION STATUS</b>
              <br />
              {authenticated && principal
                ? "Connected with " + localUserId
                : "Waiting for IC wallet connection..."}
              <br />
              <br />
              {tradeStarted && tradeData && !partnerId && !tradeId && (
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
              {tradeStarted && tradeData && partnerId && (
                <>Trading with {partnerId}</>
              )}
            </div>
          </Frame>
        </div>
      </DndProvider>
    </div>
  )
}
