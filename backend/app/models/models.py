"""
HarvestLink AI — SQLAlchemy Models (Extended)
Adds: BuyerRequest, TransportRecommendation, TruckAllocation, Notification
"""
from sqlalchemy import Column, Integer, String, Float, Date, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # farmer, buyer, transporter, admin
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    full_name = Column(String(100), nullable=True)
    created_at = Column(String(30), nullable=True)

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    farm_name = Column(String(100), nullable=True)
    location = Column(String(200), nullable=False)
    farm_size = Column(Float, nullable=False)
    producer_type = Column(String(10), nullable=False)
    crop = Column(String(50), default="Tomato")
    pan_card = Column(String(10), nullable=True)
    land_location = Column(String(300), nullable=True)
    phone = Column(String(15), nullable=True)
    email = Column(String(100), nullable=True)
    aadhaar_last4 = Column(String(4), nullable=True)

    harvests = relationship("Harvest", back_populates="farmer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Farmer {self.name} ({self.producer_type})>"


class Harvest(Base):
    __tablename__ = "harvests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    crop = Column(String(50), default="Tomato")
    estimated_quantity = Column(Float, nullable=False)
    sorted_quantity = Column(Float, nullable=True)
    reserved_quantity = Column(Float, default=0.0)    # quantity currently reserved for pending/active buyer requests
    quality_grade = Column(String(1), nullable=False)
    harvest_date = Column(String(20), nullable=False)
    available_date = Column(String(20), nullable=True)
    location = Column(String(200), nullable=True)
    expected_price = Column(Float, nullable=True)   # price in INR
    status = Column(String(20), default="estimated")  # estimated, sorted, allocated, collected, cancelled
    cancelled_at = Column(String(30), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    farmer = relationship("Farmer", back_populates="harvests")
    allocations = relationship("Allocation", back_populates="harvest", cascade="all, delete-orphan")
    buyer_requests = relationship("BuyerRequest", back_populates="harvest", cascade="all, delete-orphan")

    @property
    def available_quantity(self):
        base = self.sorted_quantity if self.sorted_quantity is not None else self.estimated_quantity
        res = self.reserved_quantity or 0.0
        return max(0.0, base - res)

    def __repr__(self):
        return f"<Harvest {self.crop} {self.available_quantity} Grade {self.quality_grade}>"


class Buyer(Base):
    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=False)
    contact = Column(String(100), nullable=True)
    phone = Column(String(15), nullable=True)
    aadhaar_last4 = Column(String(4), nullable=True)

    orders = relationship("Order", back_populates="buyer", cascade="all, delete-orphan")
    requests = relationship("BuyerRequest", back_populates="buyer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Buyer {self.name}>"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False)
    harvest_id = Column(Integer, ForeignKey("harvests.id"), nullable=True)   # linked harvest
    quantity = Column(Float, nullable=False)
    quality_grade = Column(String(1), nullable=False)
    delivery_date = Column(String(20), nullable=False)
    delivery_location = Column(String(200), nullable=True)
    recurring = Column(Boolean, default=False)
    frequency = Column(String(20), default="none")
    status = Column(String(30), default="requested")  # requested, accepted, rejected, transport_allocated, pickup_started, picked_up, in_transit, delivered, cancelled
    cancelled_at = Column(String(30), nullable=True)
    cancelled_by = Column(String(50), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    buyer = relationship("Buyer", back_populates="orders")
    allocations = relationship("Allocation", back_populates="order", cascade="all, delete-orphan")
    transport_recommendations = relationship("TransportRecommendation", back_populates="order", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Order {self.quantity} Grade {self.quality_grade} [{self.status}]>"


class BuyerRequest(Base):
    """Buyer sends a purchase request for a specific harvest."""
    __tablename__ = "buyer_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False)
    harvest_id = Column(Integer, ForeignKey("harvests.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)  # set when accepted
    quantity = Column(Float, nullable=False)
    quality_grade = Column(String(1), nullable=False)
    delivery_date = Column(String(20), nullable=False)
    delivery_location = Column(String(200), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending, accepted, rejected, cancelled
    created_at = Column(String(30), nullable=True)
    cancelled_at = Column(String(30), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    buyer = relationship("Buyer", back_populates="requests")
    harvest = relationship("Harvest", back_populates="buyer_requests")

    def __repr__(self):
        return f"<BuyerRequest {self.quantity} [{self.status}]>"


class CancellationHistory(Base):
    """Records all farmer and buyer cancellations for audit and Admin History."""
    __tablename__ = "cancellation_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cancellation_type = Column(String(20), nullable=False)  # 'order', 'request', 'harvest'
    order_id = Column(Integer, nullable=True)
    request_id = Column(Integer, nullable=True)
    harvest_id = Column(Integer, nullable=True)
    user_role = Column(String(20), nullable=False)  # 'farmer', 'buyer', 'admin'
    username = Column(String(50), nullable=True)
    farmer_name = Column(String(100), nullable=True)
    buyer_name = Column(String(100), nullable=True)
    crop = Column(String(50), nullable=True)
    quality_grade = Column(String(10), nullable=True)
    quantity = Column(Float, nullable=False)
    previous_status = Column(String(30), nullable=False)
    cancelled_status = Column(String(30), default="cancelled")
    reason = Column(Text, nullable=True)
    restored_quantity = Column(Float, default=0.0)
    created_at = Column(String(30), nullable=False)

    def __repr__(self):
        return f"<CancellationHistory {self.cancellation_type} #{self.order_id or self.harvest_id} by {self.username}>"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vehicle_number = Column(String(50), nullable=False)
    capacity = Column(Float, nullable=False)
    available_capacity = Column(Float, nullable=False)
    availability_date = Column(String(20), nullable=False)
    cost_per_trip = Column(Float, nullable=True)   # INR per trip
    driver_name = Column(String(100), nullable=True)
    driver_contact = Column(String(20), nullable=True)
    transporter_name = Column(String(100), default="Raj Transport Services")
    username = Column(String(50), nullable=True, index=True)
    current_location = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True) # Transporter active toggle
    status = Column(String(20), default="available")  # available, assigned, picking_up, in_transit, delivered, unavailable

    allocations = relationship("Allocation", back_populates="vehicle", cascade="all, delete-orphan")
    truck_allocations = relationship("TruckAllocation", back_populates="vehicle", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Vehicle {self.vehicle_number} {self.available_capacity}/{self.capacity}kg>"


class Allocation(Base):
    """Legacy allocation (supply-demand matching). Kept for backward compatibility."""
    __tablename__ = "allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    harvest_id = Column(Integer, ForeignKey("harvests.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    collection_slot = Column(String(50), nullable=True)
    status = Column(String(20), default="planned")

    harvest = relationship("Harvest", back_populates="allocations")
    order = relationship("Order", back_populates="allocations")
    vehicle = relationship("Vehicle", back_populates="allocations")

    def __repr__(self):
        return f"<Allocation {self.quantity}kg>"


class TransportRecommendation(Base):
    """AI-generated transport recommendation for an order."""
    __tablename__ = "transport_recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    required_quantity = Column(Float, nullable=False)
    allocated_capacity = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    trucks_count = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending, accepted, rejected
    created_at = Column(String(30), nullable=True)

    order = relationship("Order", back_populates="transport_recommendations")
    truck_allocations = relationship("TruckAllocation", back_populates="recommendation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TransportRecommendation order={self.order_id} {self.allocated_capacity}kg ₹{self.total_cost}>"


class TruckAllocation(Base):
    """Individual truck assigned to an order (part of a TransportRecommendation)."""
    __tablename__ = "truck_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recommendation_id = Column(Integer, ForeignKey("transport_recommendations.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    assigned_capacity = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    status = Column(String(20), default="assigned")  # assigned, picking_up, in_transit, delivered

    recommendation = relationship("TransportRecommendation", back_populates="truck_allocations")
    vehicle = relationship("Vehicle", back_populates="truck_allocations")

    def __repr__(self):
        return f"<TruckAllocation vehicle={self.vehicle_id} {self.assigned_capacity}kg>"


class Notification(Base):
    """Per-user notifications."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    role = Column(String(20), nullable=False)  # farmer, buyer, admin
    user_id = Column(Integer, nullable=True)   # farmer.id or buyer.id; NULL = broadcast to role
    event = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    order_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(String(30), nullable=True)

    def __repr__(self):
        return f"<Notification {self.role}: {self.title}>"

class Ride(Base):
    """Ride assignment for transporters."""
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(String(50), nullable=False, unique=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    transporter_username = Column(String(50), nullable=True) # Used to filter for specific transporter

    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    farmer_name = Column(String(100), nullable=False)
    pickup_address = Column(String(200), nullable=False)
    pickup_location = Column(String(200), nullable=False)
    farmer_contact = Column(String(100), nullable=True)

    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False)
    buyer_name = Column(String(100), nullable=False)
    delivery_address = Column(String(200), nullable=False)
    destination_location = Column(String(200), nullable=False)
    buyer_contact = Column(String(100), nullable=True)

    crop = Column(String(50), nullable=False)
    grade = Column(String(1), nullable=False)
    quantity = Column(Float, nullable=False)

    assigned_load = Column(Float, nullable=False)
    pickup_time = Column(String(20), nullable=True)
    expected_delivery_time = Column(String(20), nullable=True)
    delivery_deadline = Column(String(20), nullable=True)

    route = Column(Text, nullable=True)
    status = Column(String(50), default="Assigned") # Assigned, Accepted, On the way to pickup, Arrived at pickup, Pickup completed, On the way to buyer, Delivered, Completed, Cancelled
    created_at = Column(String(30), nullable=True)

    vehicle = relationship("Vehicle")
    farmer = relationship("Farmer")
    buyer = relationship("Buyer")


class RideHistory(Base):
    """Permanent history record of completed/cancelled rides for Admin."""
    __tablename__ = "ride_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(String(50), nullable=False)
    date = Column(String(30), nullable=False)
    transporter_name = Column(String(100), nullable=False)
    vehicle_number = Column(String(50), nullable=False)
    farmer_name = Column(String(100), nullable=False)
    farmer_address = Column(String(200), nullable=False)
    buyer_name = Column(String(100), nullable=False)
    buyer_address = Column(String(200), nullable=False)
    crop = Column(String(50), nullable=False)
    grade = Column(String(1), nullable=False)
    quantity_collected = Column(Float, nullable=False)
    vehicle_capacity = Column(Float, nullable=False)
    pickup_time = Column(String(20), nullable=True)
    delivery_time = Column(String(20), nullable=True)
    route = Column(Text, nullable=True)
    ride_status = Column(String(50), nullable=False)
    completion_status = Column(String(50), nullable=False)

