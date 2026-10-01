from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any
from datetime import datetime
import uuid

from app.database import get_db
from app.models.models import Ride, RideHistory, Vehicle, Farmer, Buyer

router = APIRouter(prefix="/rides", tags=["Rides"])

@router.get("/")
async def get_transporter_rides(username: str, db: AsyncSession = Depends(get_db)):
    """Get active and upcoming rides for a specific transporter."""
    result = await db.execute(
        select(Ride).where(Ride.transporter_username == username)
    )
    rides = result.scalars().all()
    return rides

@router.post("/{ride_id}/status")
async def update_ride_status(ride_id: int, status_update: dict, db: AsyncSession = Depends(get_db)):
    """Update ride status. If completed, move to history."""
    new_status = status_update.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")

    result = await db.execute(select(Ride).where(Ride.id == ride_id))
    ride = result.scalars().first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    ride.status = new_status

    if new_status == "Completed":
        # Create History
        history = RideHistory(
            trip_id=ride.trip_id,
            date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            transporter_name=ride.transporter_username or "Unknown",
            vehicle_number=str(ride.vehicle_id), # Ideally fetch vehicle number
            farmer_name=ride.farmer_name,
            farmer_address=ride.pickup_address,
            buyer_name=ride.buyer_name,
            buyer_address=ride.delivery_address,
            crop=ride.crop,
            grade=ride.grade,
            quantity_collected=ride.quantity,
            vehicle_capacity=ride.assigned_load,
            pickup_time=ride.pickup_time,
            delivery_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            route=ride.route,
            ride_status="Completed",
            completion_status="Success"
        )
        db.add(history)
        await db.delete(ride) # Remove from active rides
    elif new_status in ["Cancelled", "Failed"]:
        history = RideHistory(
            trip_id=ride.trip_id,
            date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            transporter_name=ride.transporter_username or "Unknown",
            vehicle_number=str(ride.vehicle_id),
            farmer_name=ride.farmer_name,
            farmer_address=ride.pickup_address,
            buyer_name=ride.buyer_name,
            buyer_address=ride.delivery_address,
            crop=ride.crop,
            grade=ride.grade,
            quantity_collected=0,
            vehicle_capacity=ride.assigned_load,
            pickup_time=ride.pickup_time,
            delivery_time=None,
            route=ride.route,
            ride_status=new_status,
            completion_status=status_update.get("reason", "Cancelled by user")
        )
        db.add(history)
        await db.delete(ride)

    await db.commit()
    return {"message": "Status updated successfully", "status": new_status}

@router.get("/history")
async def get_ride_history(db: AsyncSession = Depends(get_db)):
    """Admin endpoint to fetch ride history."""
    result = await db.execute(select(RideHistory))
    return result.scalars().all()

@router.delete("/history/reset")
async def reset_ride_history(db: AsyncSession = Depends(get_db)):
    """Admin endpoint to reset all ride history safely (doesn't affect active rides)."""
    # Delete all rows from RideHistory
    await db.execute(RideHistory.__table__.delete())
    await db.commit()
    return {"message": "Riding history has been reset successfully."}
