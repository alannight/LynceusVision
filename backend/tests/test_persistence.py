"""Persistence verification test across isolated database sessions."""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.models.models import Entity, Investigation, Observation, Source


@pytest.mark.asyncio
async def test_end_to_end_persistence_lifecycle() -> None:
    # 1. Setup isolated database
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    # 2. Session 1: Create Investigation, Source, Entity, Observation
    async with session_maker() as session1:
        source = Source(id="dns", display_name="DNS Lookup")
        session1.add(source)

        inv = Investigation(title="Relational Test", description="Multi-session verification")
        session1.add(inv)
        await session1.flush()
        inv_id = inv.id

        entity = Entity(investigation_id=inv_id, entity_type="domain", value="persist-target.org")
        session1.add(entity)
        await session1.flush()
        entity_id = entity.id

        obs = Observation(
            entity_id=entity_id,
            source_id="dns",
            query_context="persist-target.org",
            status="OK",
            duration_ms=32,
            normalized_data={"records": {"A": ["1.2.3.4"]}},
            raw_response='{"records": {"A": ["1.2.3.4"]}}',
        )
        session1.add(obs)
        await session1.commit()

    # 3. Session 2: Read back from fresh session
    async with session_maker() as session2:
        res = await session2.execute(select(Investigation).where(Investigation.id == inv_id))
        read_inv = res.scalar_one_or_none()
        assert read_inv is not None
        assert read_inv.title == "Relational Test"

        ent_res = await session2.execute(select(Entity).where(Entity.investigation_id == inv_id))
        entities = ent_res.scalars().all()
        assert len(entities) == 1
        assert entities[0].value == "persist-target.org"

        obs_res = await session2.execute(select(Observation).where(Observation.entity_id == entity_id))
        observations = obs_res.scalars().all()
        assert len(observations) == 1
        read_obs = observations[0]
        assert read_obs.source_id == "dns"
        assert read_obs.query_context == "persist-target.org"
        assert read_obs.status == "OK"
        assert read_obs.normalized_data == {"records": {"A": ["1.2.3.4"]}}

    # 4. Session 3: Test Cascade Deletion
    async with session_maker() as session3:
        res = await session3.execute(select(Investigation).where(Investigation.id == inv_id))
        inv_to_delete = res.scalar_one_or_none()
        assert inv_to_delete is not None
        await session3.delete(inv_to_delete)
        await session3.commit()

    # 5. Session 4: Verify Cascaded Entities and Observations are gone
    async with session_maker() as session4:
        ent_check = await session4.execute(select(Entity).where(Entity.id == entity_id))
        assert ent_check.scalar_one_or_none() is None

        obs_check = await session4.execute(select(Observation).where(Observation.entity_id == entity_id))
        assert obs_check.scalar_one_or_none() is None

    await engine.dispose()
