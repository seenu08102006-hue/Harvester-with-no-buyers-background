"""
HarvestLink AI — Farmer & Harvest Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from datetime import datetime
from app.database import get_db
from app.models.models import Farmer, Harvest, Notification
from app.websocket.manager import manager
from app.schemas.schemas import (
    FarmerCreate, FarmerResponse,
    HarvestCreate, HarvestUpdate, HarvestResponse,
)

router = APIRouter()


# ──────────────────── FARMERS ────────────────────

@router.post("/farmers", response_model=FarmerResponse, status_code=201)
async def create_farmer(farmer: FarmerCreate, db: AsyncSession = Depends(get_db)):
    """Register a new farmer."""
    db_farmer = Farmer(**farmer.model_dump())
    db.add(db_farmer)
    await db.flush()
    await db.refresh(db_farmer)
    return db_farmer


@router.get("/farmers", response_model=List[FarmerResponse])
async def list_farmers(db: AsyncSession = Depends(get_db)):
    """List all registered farmers."""
    result = await db.execute(select(Farmer))
    return result.scalars().all()


# ──────────────────── HARVESTS ────────────────────

@router.post("/harvests", response_model=HarvestResponse, status_code=201)
async def create_harvest(harvest: HarvestCreate, db: AsyncSession = Depends(get_db)):
    """Add a new harvest entry for a farmer."""
    # Verify farmer exists
    farmer = await db.get(Farmer, harvest.farmer_id)
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")

    db_harvest = Harvest(**harvest.model_dump())
    db.add(db_harvest)
    await db.flush()
    await db.refresh(db_harvest)

    # Real-time WebSocket broadcast to all (buyers, admin, etc.)
    harvest_dict = {
        "id": db_harvest.id,
        "farmer_id": db_harvest.farmer_id,
        "farmer_name": farmer.name,
        "farmer_username": getattr(farmer, "username", "farmer1"),
        "farmer_location": farmer.location,
        "crop": db_harvest.crop,
        "quantity": db_harvest.estimated_quantity,
        "quality_grade": db_harvest.quality_grade,
        "harvest_date": db_harvest.harvest_date,
        "available_date": db_harvest.available_date,
        "location": db_harvest.location or farmer.location,
        "expected_price": db_harvest.expected_price,
        "status": db_harvest.status,
    }
    await manager.broadcast_to_all("harvest_created", harvest_dict)

    # Save notifications for buyers and admin
    now_str = datetime.now().isoformat(timespec="seconds")
    notif_buyer = Notification(
        role="buyer",
        event="harvest_created",
        title="🌾 New Available Harvest",
        message=f"{farmer.name} added {db_harvest.estimated_quantity} of Grade {db_harvest.quality_grade} {db_harvest.crop}.",
        created_at=now_str,
    )
    notif_admin = Notification(
        role="admin",
        event="harvest_created",
        title="🌾 Harvest Registered",
        message=f"{farmer.name} added {db_harvest.estimated_quantity} {db_harvest.crop}.",
        created_at=now_str,
    )
    db.add(notif_buyer)
    db.add(notif_admin)
    await db.flush()

    return HarvestResponse(
        id=db_harvest.id,
        farmer_id=db_harvest.farmer_id,
        crop=db_harvest.crop,
        estimated_quantity=db_harvest.estimated_quantity,
        sorted_quantity=db_harvest.sorted_quantity,
        quality_grade=db_harvest.quality_grade,
        harvest_date=db_harvest.harvest_date,
        available_date=db_harvest.available_date,
        location=db_harvest.location,
        expected_price=db_harvest.expected_price,
        status=db_harvest.status,
        farmer_name=farmer.name,
        farmer_location=farmer.location,
        producer_type=farmer.producer_type,
    )


@router.get("/harvests", response_model=List[HarvestResponse])
async def list_harvests(db: AsyncSession = Depends(get_db)):
    """List all harvests with farmer information."""
    result = await db.execute(
        select(Harvest, Farmer)
        .join(Farmer, Harvest.farmer_id == Farmer.id)
    )
    harvests = []
    for harvest, farmer in result.all():
        harvests.append(HarvestResponse(
            id=harvest.id,
            farmer_id=harvest.farmer_id,
            crop=harvest.crop,
            estimated_quantity=harvest.estimated_quantity,
            sorted_quantity=harvest.sorted_quantity,
            quality_grade=harvest.quality_grade,
            harvest_date=harvest.harvest_date,
            available_date=harvest.available_date,
            location=harvest.location,
            expected_price=harvest.expected_price,
            status=harvest.status,
            farmer_name=farmer.name,
            farmer_location=farmer.location,
            producer_type=farmer.producer_type,
            reserved_quantity=harvest.reserved_quantity or 0.0,
            available_quantity=harvest.available_quantity,
            cancelled_at=harvest.cancelled_at,
            cancellation_reason=harvest.cancellation_reason,
        ))
    return harvests


@router.put("/harvests/{harvest_id}", response_model=HarvestResponse)
async def update_harvest(
    harvest_id: int,
    update: HarvestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a harvest entry (e.g., after sorting)."""
    harvest = await db.get(Harvest, harvest_id)
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(harvest, field, value)

    # Auto-set status to 'sorted' when sorted_quantity is updated
    if "sorted_quantity" in update_data and update_data["sorted_quantity"] is not None:
        harvest.status = "sorted"

    await db.flush()
    await db.refresh(harvest)

    farmer = await db.get(Farmer, harvest.farmer_id)

    # Real-time WebSocket broadcast to all
    await manager.broadcast_to_all("harvest_updated", {
        "id": harvest.id,
        "farmer_id": harvest.farmer_id,
        "farmer_name": farmer.name if farmer else None,
        "crop": harvest.crop,
        "quantity": harvest.available_quantity,
        "quality_grade": harvest.quality_grade,
        "status": harvest.status,
    })

    return HarvestResponse(
        id=harvest.id,
        farmer_id=harvest.farmer_id,
        crop=harvest.crop,
        estimated_quantity=harvest.estimated_quantity,
        sorted_quantity=harvest.sorted_quantity,
        quality_grade=harvest.quality_grade,
        harvest_date=harvest.harvest_date,
        available_date=harvest.available_date,
        location=harvest.location,
        expected_price=harvest.expected_price,
        status=harvest.status,
        farmer_name=farmer.name if farmer else None,
        farmer_location=farmer.location if farmer else None,
        producer_type=farmer.producer_type if farmer else None,
    )


@router.delete("/harvests/{harvest_id}")
async def delete_harvest(harvest_id: int, db: AsyncSession = Depends(get_db)):
    """Safe delete for Farmer Harvest."""
    harvest = await db.get(Harvest, harvest_id)
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")

    # If the harvest is connected to an active order/request
    if harvest.reserved_quantity and harvest.reserved_quantity > 0:
        harvest.status = "closed"
        harvest.cancelled_at = datetime.now().isoformat()
        harvest.cancellation_reason = "Farmer removed harvest"
        await db.commit()
    else:
        # Safe to delete completely
        await db.delete(harvest)
        await db.commit()

    # Real-time WebSocket broadcast to remove from Buyer dashboard
    await manager.broadcast_to_all("harvest_deleted", {"id": harvest_id})

    return {"message": "Harvest deleted successfully", "id": harvest_id}

