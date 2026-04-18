"""
Local backtest API for InvestAIV1. Run: uvicorn app:app --host 127.0.0.1 --port 8765 --reload
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from runner import list_strategies, run_backtest

app = FastAPI(title="InvestAIV1 Backtest", version="1.0.0")

# Load keys from the same locations as the Node API
try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv("../server/.env")
    load_dotenv("../server/.env.local")
    load_dotenv(".env")
except Exception:
    pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class BacktestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(..., min_length=1, max_length=16)
    strategy_id: str = Field(..., alias="strategyId")
    start: str | None = Field(None, description="YYYY-MM-DD inclusive")
    end: str | None = Field(None, description="YYYY-MM-DD exclusive where supported")
    params: dict[str, Any] | None = None


@app.get("/health")
def health():
    return {"ok": True, "service": "investaiv1-backtest"}


@app.get("/strategies")
def strategies():
    return {"strategies": list_strategies()}


@app.post("/backtest")
def backtest(req: BacktestRequest):
    sym = req.symbol.strip().upper()
    if not re.match(r"^[A-Z0-9.\-]{1,16}$", sym):
        raise HTTPException(status_code=400, detail="Invalid symbol")
    try:
        result = run_backtest(
            req.strategy_id,
            sym,
            req.start,
            req.end,
            req.params,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
