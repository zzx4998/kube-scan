import React, { useReducer, useEffect } from "react";
import "./fonts/fonts.scss";
import "./index.scss";
import "./App.scss";
import Toolbar from "./components/Toolbar/Toolbar";
import runtimeConfig from "./config";
import BottomBar from "./components/BottomBar/BottomBar";
import { get as lookupGet } from "lodash";
import { RiskBreakdownPopup, parseK8sRisksWorkloads } from "@octarine/ui-common";
import "@octarine/ui-common/dist/main.css";

const getRefreshStatusIntervalSeconds = 5
let cNames = "OCApp side-menu-on";

export const DataContext = React.createContext(null);

let secondarySortField = "risk.riskScore";

let sortData = (sortField, ascending) => {
  return (a, b) => {
    function compare(field) {
      let aVal = lookupGet(a, field),
        bVal = lookupGet(b, field);
      if (aVal < bVal) {
        return ascending ? -1 : 1;
      } else if (aVal === bVal) {
        return 0;
      } else {
        return ascending ? 1 : -1;
      }
    }

    let primaryResult = compare(sortField);
    if (primaryResult !== 0) {
      return primaryResult;
    } else {
      if (secondarySortField === sortField) {
        return primaryResult;
      } else {
        return compare(secondarySortField);
      }
    }
  };
};

function reducer(state, action) {
  switch (action.type) {
    case "set":
      let newState = {
        data: action.data.data,
        sortField: state.sortField,
        ascending: state.ascending,
        popupOn: state.popupOn,
        refreshing: state.refreshing
      };
      if (newState.data) {
        newState.data.sort(sortData(state.sortField, state.ascending));
      }

      return newState;
    case "setRefreshState":
      return {
        data: state.data,
        sortField: state.sortField,
        ascending: state.ascending,
        popupOn: state.popupOn,
        refreshing: action.refreshing
      }
    case "sort":
      if (state.sortField === action.sortField) {
        state.ascending = !state.ascending;
      }
      state.data.sort(sortData(action.sortField, state.ascending));
      return {
        data: state.data,
        sortField: action.sortField,
        ascending: state.ascending,
        refreshing: state.refreshing
      };
    case "popup":
      return {
        data: state.data,
        sortField: state.sortField,
        ascending: state.ascending,
        popupOn: true,
        popupData: action.riskData,
        refreshing: state.refreshing
      };
    case "closePopup":
      return {
        data: state.data,
        sortField: state.sortField,
        ascending: state.ascending,
        popupOn: false,
        refreshing: state.refreshing
      };
    default:
      throw new Error();
  }
}

const initialState = {
  data: null,
  sortField: "risk.riskScore",
  ascending: false,
  popupOn: false,
  refreshing: false
};

function App(props) {
  const [state, dispatch] = useReducer(reducer, initialState);

  async function fetchData() {
    const result = await fetch("/api/risks");
    const { data } = await result.json();

    dispatch({
      type: "set",
      data: { data: parseK8sRisksWorkloads(data) }
    });
  }

  async function updateRefreshingStatus() {
    const result = await fetch("/api/refreshing_status");
    const { refreshing } = await result.json();

    if (state.refreshing && !refreshing) {
      fetchData();
    }

    dispatch({
      type: "setRefreshState",
      refreshing: refreshing
    });

    await new Promise(resolve => setTimeout(resolve, getRefreshStatusIntervalSeconds * 1000));
    await updateRefreshingStatus();
  }

  useEffect(() => {
    fetchData();
    updateRefreshingStatus()
  }, []);

  async function refreshState() {
    dispatch({
      type: "setRefreshState",
      refreshing: true
    });
    const result = await fetch("/api/refresh", {method: 'post'});
    await result.json();
  }

  function closePopup() {
    dispatch({
      type: "closePopup"
    });
  }
  return (
    <div className={cNames}>
      <Toolbar contactLink={runtimeConfig.contactLink} />
      <div className="app-main-row">
        <DataContext.Provider value={{ state, dispatch, onRefreshClick: refreshState }}>
          <div className="current-page-wrapper">{props.children}</div>
        </DataContext.Provider>
      </div>
      <BottomBar websiteLink={runtimeConfig.websiteLink} />
      {state.popupOn ? (
        <RiskBreakdownPopup
          workload={state.popupData}
          onClose={closePopup}
        ></RiskBreakdownPopup>
      ) : null}
    </div>
  );
}

export default App;
